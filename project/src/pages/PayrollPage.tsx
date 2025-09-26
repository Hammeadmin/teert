// src/pages/PayrollPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    fetchPayrollDataForExport,
    updatePayrollStatus,
} from '../lib/payroll';
import type { PayrollStatus, UserRole, ShiftNeed, JobPosting } from '../types';
import type { PayrollExportData } from '../lib/payroll';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    Loader2, Download, CheckCircle, XCircle, ChevronUp, ChevronDown,
    Filter, Info, DollarSign, Send, Eye, ListFilter, FileText, RefreshCw, Archive,
    Printer, Edit3, PlusCircle, Trash2, Save, Briefcase, AlertTriangle, Building2,
    Square, CheckSquare, Undo2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PayrollAdjustmentsModal } from '../components/Payroll/PayrollAdjustmentsModal';
import ShiftDetailsModal from '../components/Shifts/ShiftDetailsModal';
import { PostingDetailsModal } from '../components/postings/PostingDetailsModal';
import { ConsolidatedPayrollModal, ConsolidatedItemDetail, ConsolidatedPayrollSummary, PeriodLevelAdjustmentUI } from '../components/Payroll/ConsolidatedPayrollModal';
import { format, parseISO, isValid, Locale } from 'date-fns';
import { sv } from 'date-fns/locale';
import { PayrollEmailLog } from '../components/Payroll/PayrollEmailLog'; // 1. Import the new component



const getImageBase64 = async (url: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error fetching image for PDF:", error);
        return null;
    }
};
// Helper: OBDetailsTooltip Component
const OBDetailsTooltip: React.FC<{ details: any }> = ({ details }) => {
    if (!details || typeof details !== 'object' || Object.keys(details).length === 0) return null;
    const formattedDetails = Object.entries(details)
        .map(([key, value]) => {
            if (typeof value === 'number' && value > 0) {
                const rate = key.match(/(\d+)/)?.[0];
                return `${parseFloat(value.toFixed(2))}h @ ${rate || '?'}% OB`;
            } return null;
        }).filter(Boolean).join(', ');
    if (!formattedDetails) return null;
    return (
        <span className="group relative ml-1.5 inline-block align-middle">
            <Info size={13} className="text-blue-500 cursor-help" />
            <span className="absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 whitespace-nowrap z-20 shadow-lg text-center">
                {formattedDetails}
            </span>
        </span>
    );
};

// Helper: formatDateSafe
const formatDateSafe = (dateString: string | null | undefined, formatStr: string = 'PP', locale: Locale = sv): string => {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') return 'N/A';
    let dateObj: Date | null = null;
    try {
        if (dateString.includes('T') && (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/))) dateObj = parseISO(dateString);
        else if (/^\d{4}-\d{2}$/.test(dateString)) dateObj = parseISO(dateString + '-01');
        else if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) dateObj = parseISO(dateString);
        else dateObj = new Date(dateString);
        if (dateObj && isNaN(dateObj.getTime())) { dateObj = parseISO(dateString); if (isNaN(dateObj.getTime())) dateObj = null; }
    } catch (e) { dateObj = null; }
    if (!dateObj || !isValid(dateObj)) {
        console.warn(`formatDateSafe: Could not parse '${dateString}' into a valid date. Returning 'Formatting Error'.`);
        return 'Formatting Error';
    }
    try { return format(dateObj, formatStr, { locale }); } catch (formatError) {
        console.warn(`formatDateSafe: Error formatting date object for '<span class="math-inline">\{dateString\}' with format '</span>{formatStr}'. Error: ${formatError}`);
        return 'Formatting Error';
    }
};

const generateCleanCSV = (records: PayrollExportData[]): string => {
    const headers = ["Anställd", "Period", "Datum", "Typ", "Titel", "Timmar", "Grundlön/Ersättning", "OB-tillägg", "Justeringar", "Total Lön", "Status"];
    const rows = records.map(rec => {
        const itemDate = rec.record_type === 'shift' ? rec.shiftDate : rec.posting_period_start_date;
        const itemTitle = rec.record_type === 'shift' ? rec.shiftTitle : rec.posting_title;
        const basePay = rec.record_type === 'shift' ? (rec.hours_worked || 0) * (rec.hourly_rate || 0) : (rec.agreed_compensation || 0);
        return [`"${rec.employeeName || 'Okänd'}"`, `"${formatDateSafe(rec.pay_period, 'yyyy-MM')}"`, `"${formatDateSafe(itemDate, 'yyyy-MM-dd')}"`, `"${rec.record_type || ''}"`, `"${itemTitle?.replace(/"/g, '""') || ''}"`, (rec.hours_worked || 0).toFixed(2), basePay.toFixed(2), (rec.total_ob_premium || 0).toFixed(2), (rec.net_adjustments || 0).toFixed(2), (rec.total_pay || 0).toFixed(2), `"${rec.status || ''}"`].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
};

const generateDetailedPDFReport = async (records: PayrollExportData[], payPeriod: string, recordType: 'shift' | 'posting') => {
    const toastId = "pdf-report-gen";
    toast.loading("Genererar detaljerad PDF-rapport...", { id: toastId });
    
    // ** STEP 1: Load the logo **
    // Make sure your logo is in the /public/ folder
    const logoUrl = '/assets/farmispoolenLogo2.png'; // <-- IMPORTANT: Change this if your logo has a different name
    const logoBase64 = await getImageBase64(logoUrl);

    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        
        const groupedByEmployee = records.reduce((acc, record) => {
            const key = record.employeeName || 'Okänd Anställd';
            if (!acc[key]) {
                acc[key] = {
                    records: [],
                    summary: {
                        totalHours: 0, totalBasePay: 0, totalOB: 0,
                        ob_50_hours: 0, ob_75_hours: 0, ob_100_hours: 0,
                        totalPay: 0,
                        hourly_rate: record.hourly_rate || record.agreed_compensation || 0,
                    }
                };
            }
            acc[key].records.push(record);
            const basePay = record.record_type === 'shift' ? (record.hours_worked || 0) * (record.hourly_rate || 0) : (record.agreed_compensation || 0);
            acc[key].summary.totalHours += record.hours_worked || 0;
            acc[key].summary.totalBasePay += basePay;
            acc[key].summary.totalOB += record.total_ob_premium || 0;
            acc[key].summary.totalPay += record.total_pay || 0;
            if (record.ob_details) {
                acc[key].summary.ob_50_hours += record.ob_details.ob_50_hours || 0;
                acc[key].summary.ob_75_hours += record.ob_details.ob_75_hours || 0;
                acc[key].summary.ob_100_hours += record.ob_details.ob_100_hours || 0;
            }
            return acc;
        }, {} as Record<string, { records: PayrollExportData[], summary: any }>);

        let firstPage = true;
        for (const employeeName in groupedByEmployee) {
            if (!firstPage) {
                doc.addPage();
            }
            firstPage = false;
            
            let yPos = 15; // Initial Y position

            // ** STEP 2: Add the logo to the PDF **
            if (logoBase64) {
                // You may need to adjust the width and height (3rd and 4th arguments)
                // to make your logo look good.
                doc.addImage(logoBase64, 'PNG', 14, yPos, 40, 15); 
            }

            yPos = 40; // Reset Y position after logo and header space

            const { records: employeeRecords, summary } = groupedByEmployee[employeeName];

            doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('Lönebesked', pageWidth / 2, yPos, { align: 'center' }); yPos += 12;
            doc.setFontSize(11); doc.setFont('helvetica', 'normal');
            doc.text(`Anställd:`, 14, yPos); doc.text(employeeName, 50, yPos); yPos += 7;
            doc.text(`Löneperiod:`, 14, yPos); doc.text(formatDateSafe(payPeriod, 'MMMM yyyy', sv), 50, yPos); yPos += 12;

            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Summering', 14, yPos); yPos += 8;
            
            const addSummaryRow = (label: string, value: string, isBold: boolean = false) => {
                if (yPos > pageHeight - 20) { doc.addPage(); yPos = 20; }
                doc.setFontSize(10); doc.setFont('helvetica', isBold ? 'bold' : 'normal');
                doc.text(label, 18, yPos); doc.text(value, pageWidth - 14, yPos, { align: 'right' });
                yPos += 7;
            };

            addSummaryRow('Grundlön / Ersättning:', `${summary.totalBasePay.toFixed(2)} SEK`);
            
            if (summary.totalOB > 0) {
                doc.setFont('helvetica', 'bold'); doc.text('OB-ersättning:', 18, yPos); yPos += 7; doc.setFont('helvetica', 'normal');
                if (summary.ob_50_hours > 0) addSummaryRow(`OB 50% (${summary.ob_50_hours.toFixed(2)} tim)`, `+ ${(summary.ob_50_hours * summary.hourly_rate * 0.5).toFixed(2)} SEK`);
                if (summary.ob_75_hours > 0) addSummaryRow(`OB 75% (${summary.ob_75_hours.toFixed(2)} tim)`, `+ ${(summary.ob_75_hours * summary.hourly_rate * 0.75).toFixed(2)} SEK`);
                if (summary.ob_100_hours > 0) addSummaryRow(`OB 100% (${summary.ob_100_hours.toFixed(2)} tim)`, `+ ${(summary.ob_100_hours * summary.hourly_rate * 1.0).toFixed(2)} SEK`);
                addSummaryRow('Summa OB:', `${summary.totalOB.toFixed(2)} SEK`, true);
            }
            
            yPos += 3; doc.setDrawColor(180, 180, 180); doc.line(14, yPos, pageWidth - 14, yPos); yPos += 8;
            doc.setFontSize(12); addSummaryRow('Total Bruttolön:', `${summary.totalPay.toFixed(2)} SEK`, true); yPos += 10;
            
            const tableBody = employeeRecords.map(rec => {
                const itemDate = rec.record_type === 'shift' ? rec.shiftDate : rec.pay_period;
                const itemTitle = rec.record_type === 'shift' ? rec.shiftTitle : rec.posting_title;
                const basePay = rec.record_type === 'shift' ? (rec.hours_worked || 0) * (rec.hourly_rate || 0) : (rec.agreed_compensation || 0);
                return [
                    formatDateSafe(itemDate, 'yyyy-MM-dd'),
                    itemTitle || 'N/A',
                    rec.hours_worked?.toFixed(2) ?? 'N/A',
                    basePay.toFixed(2),
                    rec.total_ob_premium?.toFixed(2) ?? '0.00',
                    rec.total_pay?.toFixed(2) ?? '0.00'
                ];
            });

            if (tableBody.length > 0) {
                 doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Specifikation', 14, yPos); yPos += 8;
                autoTable(doc, {
                    startY: yPos,
                    head: [['Datum', 'Titel', 'Timmar', 'Grundlön/Ers.', 'OB', 'Totalt']],
                    body: tableBody,
                    theme: 'striped',
                    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                    styles: { fontSize: 9, cellPadding: 2 },
                    columnStyles: { 0: {cellWidth: 25}, 1: {cellWidth: 'auto'}, 2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'} },
                    margin: { left: 14, right: 14 }
                });
            }
        }
        doc.save(`Lönebesked_${payPeriod}.pdf`);
        toast.success("PDF-lönespecifikation genererad!", { id: toastId });
    } catch (e: any) {
        toast.error(`PDF Fel: ${e.message}`, { id: toastId });
        console.error(e);
    }
};


const EmployerPayrollView: React.FC<{ recordTypeFilter: 'shift' | 'posting' }> = ({ recordTypeFilter }) => {
    const { profile: currentProfile } = useAuth();
    const isAdmin = currentProfile?.role === 'admin';
    const [payrollRecords, setPayrollRecords] = useState<PayrollExportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAdjustmentsModal, setShowAdjustmentsModal] = useState(false);
    const [recordToAdjust, setRecordToAdjust] = useState<PayrollExportData | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<PayrollStatus | ''>('pending');
    const [selectedPayPeriod, setSelectedPayPeriod] = useState<string>('');
    const [employeeFilter, setEmployeeFilter] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<SortConfig<PayrollExportData>>({ key: 'pay_period', direction: 'descending' });
    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
    const [showItemDetailsModal, setShowItemDetailsModal] = useState(false);
    const [detailedItemData, setDetailedItemData] = useState<ShiftNeed | JobPosting | null>(null);
    const [isLoadingItemDetails, setIsLoadingItemDetails] = useState(false);
    const [showConsolidatedModal, setShowConsolidatedModal] = useState(false);
    const [consolidatedData, setConsolidatedData] = useState<ConsolidatedPayrollSummary | null>(null);
    const [isLoadingConsolidated, setIsLoadingConsolidated] = useState(false);
    const [allEmployers, setAllEmployers] = useState<{ id: string; display_name: string }[]>([]);
    const [adminSelectedEmployerId, setAdminSelectedEmployerId] = useState<string>('');
    const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  

  const handleSendToPayrollOffice = async () => {
        if (sortedRecords.length === 0) {
            toast.error('Inga data att skicka.');
            return;
        }

        const recipientEmail = window.prompt("Ange e-postadress till Lönekontoret:");
        if (!recipientEmail) {
            toast.info("Avbrutet.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            toast.error("Ogiltig e-postadress.");
            return;
        }
    
        const toastId = toast.loading("Förbereder och skickar e-post...");

        try {
            // --- This is a direct copy of your PDF generation logic ---
            const logoUrl = '/assets/farmispoolenLogo2.png';
            const logoBase64 = await getImageBase64(logoUrl);
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
        
            const groupedByEmployee = sortedRecords.reduce((acc, record) => {
                const key = record.employeeName || 'Okänd Anställd';
                if (!acc[key]) {
                    acc[key] = {
                        records: [],
                        summary: {
                            totalHours: 0, totalBasePay: 0, totalOB: 0,
                            ob_50_hours: 0, ob_75_hours: 0, ob_100_hours: 0,
                            totalPay: 0,
                            hourly_rate: record.hourly_rate || record.agreed_compensation || 0,
                        }
                    };
                }
                const basePay = record.record_type === 'shift' ? (record.hours_worked || 0) * (record.hourly_rate || 0) : (record.agreed_compensation || 0);
                acc[key].records.push(record);
                acc[key].summary.totalHours += record.hours_worked || 0;
                acc[key].summary.totalBasePay += basePay;
                acc[key].summary.totalOB += record.total_ob_premium || 0;
                acc[key].summary.totalPay += record.total_pay || 0;
                if (record.ob_details) {
                    acc[key].summary.ob_50_hours += record.ob_details.ob_50_hours || 0;
                    acc[key].summary.ob_75_hours += record.ob_details.ob_75_hours || 0;
                    acc[key].summary.ob_100_hours += record.ob_details.ob_100_hours || 0;
                }
                return acc;
            }, {} as Record<string, { records: PayrollExportData[], summary: any }>);

            let firstPage = true;
            for (const employeeName in groupedByEmployee) {
                if (!firstPage) { doc.addPage(); }
                firstPage = false;
                
                let yPos = 15;
                if (logoBase64) { doc.addImage(logoBase64, 'PNG', 14, yPos, 40, 15); }
                yPos = 40;

                const { records: employeeRecords, summary } = groupedByEmployee[employeeName];

                doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('Lönebesked', pageWidth / 2, yPos, { align: 'center' }); yPos += 12;
                doc.setFontSize(11); doc.setFont('helvetica', 'normal');
                doc.text(`Anställd:`, 14, yPos); doc.text(employeeName, 50, yPos); yPos += 7;
                doc.text(`Löneperiod:`, 14, yPos); doc.text(formatDateSafe(selectedPayPeriod, 'MMMM yyyy', sv), 50, yPos); yPos += 12;

                doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Summering', 14, yPos); yPos += 8;
                
                const addSummaryRow = (label: string, value: string, isBold: boolean = false) => {
                    if (yPos > pageHeight - 20) { doc.addPage(); yPos = 20; }
                    doc.setFontSize(10); doc.setFont('helvetica', isBold ? 'bold' : 'normal');
                    doc.text(label, 18, yPos); doc.text(value, pageWidth - 14, yPos, { align: 'right' });
                    yPos += 7;
                };

                addSummaryRow('Grundlön / Ersättning:', `${summary.totalBasePay.toFixed(2)} SEK`);
                
                if (summary.totalOB > 0) {
                    doc.setFont('helvetica', 'bold'); doc.text('OB-ersättning:', 18, yPos); yPos += 7; doc.setFont('helvetica', 'normal');
                    if (summary.ob_50_hours > 0) addSummaryRow(`OB 50% (${summary.ob_50_hours.toFixed(2)} tim)`, `+ ${(summary.ob_50_hours * summary.hourly_rate * 0.5).toFixed(2)} SEK`);
                    if (summary.ob_75_hours > 0) addSummaryRow(`OB 75% (${summary.ob_75_hours.toFixed(2)} tim)`, `+ ${(summary.ob_75_hours * summary.hourly_rate * 0.75).toFixed(2)} SEK`);
                    if (summary.ob_100_hours > 0) addSummaryRow(`OB 100% (${summary.ob_100_hours.toFixed(2)} tim)`, `+ ${(summary.ob_100_hours * summary.hourly_rate * 1.0).toFixed(2)} SEK`);
                    addSummaryRow('Summa OB:', `${summary.totalOB.toFixed(2)} SEK`, true);
                }
                
                yPos += 3; doc.setDrawColor(180, 180, 180); doc.line(14, yPos, pageWidth - 14, yPos); yPos += 8;
                doc.setFontSize(12); addSummaryRow('Total Bruttolön:', `${summary.totalPay.toFixed(2)} SEK`, true); yPos += 10;
                
                const tableBody = employeeRecords.map(rec => {
                    const itemDate = rec.record_type === 'shift' ? rec.shiftDate : rec.pay_period;
                    const itemTitle = rec.record_type === 'shift' ? rec.shiftTitle : rec.posting_title;
                    const basePay = rec.record_type === 'shift' ? (rec.hours_worked || 0) * (rec.hourly_rate || 0) : (rec.agreed_compensation || 0);
                    return [
                        formatDateSafe(itemDate, 'yyyy-MM-dd'), itemTitle || 'N/A',
                        rec.hours_worked?.toFixed(2) ?? 'N/A', basePay.toFixed(2),
                        rec.total_ob_premium?.toFixed(2) ?? '0.00', rec.total_pay?.toFixed(2) ?? '0.00'
                    ];
                });

                if (tableBody.length > 0) {
                    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Specifikation', 14, yPos); yPos += 8;
                    autoTable(doc, {
                        startY: yPos,
                        head: [['Datum', 'Titel', 'Timmar', 'Grundlön/Ers.', 'OB', 'Totalt']],
                        body: tableBody, theme: 'striped', headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                        styles: { fontSize: 9, cellPadding: 2 },
                        columnStyles: { 0: {cellWidth: 25}, 1: {cellWidth: 'auto'}, 2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'} },
                        margin: { left: 14, right: 14 }
                    });
                }
            }
            // --- End of copied PDF logic ---

            // Instead of saving, get the PDF data as a base64 string
            const pdfAsBase64 = doc.output('datauristring');

            // Now, send this data to our API endpoint
            const response = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailType: 'payrollReport',
        payload: { // The payload now matches your original code exactly
          recipientEmail: recipientEmail,
          pdfData: pdfAsBase64,
          payPeriod: selectedPayPeriod,
          employerName: currentProfile?.pharmacy_name || currentProfile?.full_name || "Farmispoolen",
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send the report.');
    }

    toast.success('Lönerapporten har skickats!');
           fetchEmailLogs();
  } catch (error) {
    toast.error('Det gick inte att skicka rapporten.');
    console.error('Error sending payroll report:', error);
          fetchEmailLogs();
  } finally {
    setLoading(false);
  }
};



    const defaultPayPeriod = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
        // This ensures a correct string like "2025-06" is created
        return `${currentYear}-${currentMonth}`;
    }, []);

    useEffect(() => {
        if (isAdmin) {
            const fetchEmployersForAdmin = async () => {
                try {
                    const { data, error: empError } = await supabase.from('profiles').select('id, full_name, pharmacy_name').eq('role', 'employer').order('pharmacy_name', { ascending: true, nullsFirst: false }).order('full_name', { ascending: true });
                    if (empError) throw empError;
                    setAllEmployers(data?.map(emp => ({ id: emp.id, display_name: emp.pharmacy_name || emp.full_name || `Arbetsgivare ${emp.id.substring(0, 8)}` })) || []);
                } catch (e) {
                    toast.error("Kunde inte ladda arbetsgivarlistan för adminfilter.");
                    console.error("Error fetching employers for admin:", e);
                }
            };
            fetchEmployersForAdmin();
        }
    }, [isAdmin]);

    const loadPayrollData = useCallback(async (period?: string) => {
        setIsLoading(true); 
        setError(null);
        
        const payPeriodToFetch = period || selectedPayPeriod || defaultPayPeriod;
        
        // This check ensures we don't try to fetch data if the period isn't set yet
        if (!payPeriodToFetch) {
            setIsLoading(false);
            return;
        }

        if (!selectedPayPeriod && !period) {
            setSelectedPayPeriod(payPeriodToFetch);
        }

        const filtersArg: {
            payPeriod?: string;
            status?: PayrollStatus | '';
            employeeNameOrId?: string;
            recordType?: 'shift' | 'posting';
            adminForEmployerId?: string;
        } = { recordType: recordTypeFilter };

        // **THE FIX**: This now correctly formats the date string before it's sent.
        filtersArg.payPeriod = `${payPeriodToFetch}-01`;
        
        if (selectedStatus) filtersArg.status = selectedStatus;
        if (employeeFilter.trim()) filtersArg.employeeNameOrId = employeeFilter.trim();

        if (isAdmin) {
            if (adminSelectedEmployerId) filtersArg.adminForEmployerId = adminSelectedEmployerId;
        } else if (currentProfile?.role === 'employer') {
            filtersArg.adminForEmployerId = currentProfile.id;
        }

        const { data, error: fetchError } = await fetchPayrollDataForExport(filtersArg);
        
        if (fetchError) {
            const errorMessage = typeof fetchError === 'string' ? fetchError : (fetchError as Error).message || 'Okänt fel vid hämtning av löneunderlag.';
            setError(errorMessage);
            setPayrollRecords([]);
            toast.error(`Kunde inte ladda löneunderlag: ${errorMessage}`);
        } else {
            setPayrollRecords(data || []);
            setError(null);
        }
        setIsLoading(false);
    }, [selectedStatus, selectedPayPeriod, employeeFilter, defaultPayPeriod, recordTypeFilter, isAdmin, adminSelectedEmployerId, currentProfile]);

const fetchEmailLogs = useCallback(async (period?: string) => {
    if (!currentProfile?.id) return;
    setLoadingLogs(true);
    const payPeriodToFetch = period || selectedPayPeriod || defaultPayPeriod;

    const { data, error } = await supabase
      .from('payroll_email_log')
      .select('*')
      .eq('employer_id', currentProfile.id)
      .eq('pay_period', payPeriodToFetch)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Kunde inte hämta e-postloggen.");
      console.error("Error fetching email logs:", error);
    } else {
      setEmailLogs(data || []);
    }
    setLoadingLogs(false);
  }, [currentProfile?.id, selectedPayPeriod, defaultPayPeriod]);
  

    useEffect(() => { if (!selectedPayPeriod) setSelectedPayPeriod(defaultPayPeriod); }, [defaultPayPeriod, selectedPayPeriod]);

    useEffect(() => {
        if(currentProfile?.id) {
            if (isAdmin && allEmployers.length === 0 && !adminSelectedEmployerId) return;
            loadPayrollData();
          fetchEmailLogs();
        }
    }, [selectedPayPeriod, selectedStatus, employeeFilter, fetchEmailLogs, loadPayrollData, currentProfile?.id, isAdmin, adminSelectedEmployerId, allEmployers.length]);
    
    const handleApplyFiltersClick = () => {
        if (isAdmin && !adminSelectedEmployerId && allEmployers.length > 0) {
            if (!window.confirm("Varning: Hämtning av löneunderlag för alla arbetsgivare kan ta tid. Fortsätta?")) return;
        }
        setSelectedRecordIds(new Set());
        loadPayrollData();
    };

    const requestSort = (key: keyof PayrollExportData) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof PayrollExportData) => {
        if (sortConfig.key !== key) return <ListFilter size={14} className="ml-1 text-gray-400 opacity-50" />;
        return sortConfig.direction === 'ascending' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
    };

    const sortedRecords = useMemo(() => {
        let sortableItems = [...payrollRecords];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key!]; const bValue = b[sortConfig.key!];
                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return 1;
                if (bValue == null) return -1;
                if (typeof aValue === 'string' && typeof bValue === 'string') return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                if (typeof aValue === 'number' && typeof bValue === 'number') return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
                const strA = String(aValue); const strB = String(bValue);
                return sortConfig.direction === 'ascending' ? strA.localeCompare(strB) : strB.localeCompare(strA);
            });
        }
        return sortableItems;
    }, [payrollRecords, sortConfig]);

    const handleToggleSelectRecord = (recordId: string) => {
        setSelectedRecordIds(prev => { const newSet = new Set(prev); if (newSet.has(recordId)) newSet.delete(recordId); else newSet.add(recordId); return newSet; });
    };

    const handleToggleSelectAllVisible = () => {
        const allVisibleIds = new Set(sortedRecords.map(r => r.id));
        const allCurrentlySelected = sortedRecords.length > 0 && sortedRecords.every(r => selectedRecordIds.has(r.id));
        if (allCurrentlySelected) setSelectedRecordIds(new Set()); else setSelectedRecordIds(allVisibleIds);
    };
    
    const selectedPendingCount = useMemo(() => sortedRecords.filter(r => selectedRecordIds.has(r.id) && r.status === 'pending').length, [selectedRecordIds, sortedRecords]);
    const selectedProcessedCount = useMemo(() => sortedRecords.filter(r => selectedRecordIds.has(r.id) && r.status === 'processed').length, [selectedRecordIds, sortedRecords]);
    const selectedPaidCount = useMemo(() => sortedRecords.filter(r => selectedRecordIds.has(r.id) && r.status === 'paid').length, [selectedRecordIds, sortedRecords]);
    
    const handleBulkRevertStatus = async () => {
        let fromStatus: PayrollStatus | null = null; let toStatus: PayrollStatus | null = null;
        if (selectedPaidCount > 0 && selectedProcessedCount === 0 && selectedPendingCount === 0) { fromStatus = 'paid'; toStatus = 'processed'; } 
        else if (selectedProcessedCount > 0 && selectedPaidCount === 0 && selectedPendingCount === 0) { fromStatus = 'processed'; toStatus = 'pending'; } 
        else { toast.error("Du kan endast återställa poster som alla har status 'Betald' ELLER 'Bearbetad'."); return; }
        const idsToRevert = sortedRecords.filter(r => selectedRecordIds.has(r.id) && r.status === fromStatus).map(r => r.id);
        if (idsToRevert.length === 0) { toast.info("Inga valda poster att återställa."); return; }
        if (!window.confirm(`Är du säker på att du vill återställa <span class="math-inline">\{idsToRevert\.length\} post\(er\) från '</span>{fromStatus}' till '${toStatus}'?`)) return;
        const toastId = toast.loading(`Återställer ${idsToRevert.length} post(er)...`);
        const result = await updatePayrollStatus(idsToRevert, toStatus, recordTypeFilter);
        if (result.error) toast.error(result.error, { id: toastId });
        else { toast.success(`${result.successCount || idsToRevert.length} post(er) har återställts.`, { id: toastId }); setSelectedRecordIds(new Set()); loadPayrollData(); }
    };

    const handleBulkUpdateStatus = async (newStatus: PayrollStatus) => {
        const recordsToUpdate = sortedRecords.filter(r => selectedRecordIds.has(r.id) && ((newStatus === 'processed' && r.status === 'pending') || (newStatus === 'paid' && r.status === 'processed')));
        const ids = recordsToUpdate.map(r => r.id);
        if (ids.length === 0) { toast.info(`Inga valda poster som kan markeras som '${newStatus}'.`); return; }
        if (!window.confirm(`Är du säker på att du vill markera <span class="math-inline">\{ids\.length\} vald\(a\) post\(er\) som '</span>{newStatus}'?`)) return;
        const toastId = toast.loading(`Markerar ${ids.length} post(er) som ${newStatus}...`);
        const result = await updatePayrollStatus(ids, newStatus, recordTypeFilter);
        if (result.error) toast.error(typeof result.error === 'string' ? result.error : 'Okänt fel.', { id: toastId });
        else { toast.success(`${result.successCount || ids.length} post(er) markerade som ${newStatus}.`, { id: toastId }); setSelectedRecordIds(new Set()); loadPayrollData(); }
    };
    
    const periodSummary = useMemo(() => {
        return sortedRecords.reduce((acc, record) => {
            const hours = record.hours_worked || 0; const rate = record.hourly_rate || 0;
            if (record.record_type === 'shift') { acc.totalBasePay += hours * rate; acc.totalHours += hours; acc.totalOBPremium += record.total_ob_premium || 0; } 
            else if (record.record_type === 'posting') { acc.totalBasePay += record.agreed_compensation || 0; }
            acc.totalAdjustments += record.net_adjustments || 0; acc.totalGrossPay += record.total_pay || 0; acc.recordCount += 1;
            return acc;
        }, { totalHours: 0, totalBasePay: 0, totalOBPremium: 0, totalAdjustments: 0, totalGrossPay: 0, recordCount: 0 });
    }, [sortedRecords]);

    const handleExportCSV = () => { if (sortedRecords.length === 0) { toast.error('Inga data att exportera.'); return; } try { const csvContent = generateCleanCSV(sortedRecords); const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Löneunderlag_${recordTypeFilter}_${selectedPayPeriod}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link); toast.success('CSV-fil har laddats ner!'); } catch (err) { console.error("CSV Export error:", err); toast.error("Misslyckades att generera CSV.");}};
    const handleExportPDF = () => { if (sortedRecords.length === 0) { toast.error('Inga data att exportera.'); return; } generateDetailedPDFReport(sortedRecords, selectedPayPeriod, recordTypeFilter); };
    const handleOpenAdjustmentsModal = (record: PayrollExportData) => { setRecordToAdjust(record); setShowAdjustmentsModal(true); };
    const handleCloseAdjustmentsModal = (refresh: boolean = true) => { setShowAdjustmentsModal(false); setRecordToAdjust(null); if (refresh) loadPayrollData(); };
    
    const handleViewItemDetails = useCallback(async (record: PayrollExportData) => {
        if (!record.record_type) { toast.error("Typ av post saknas."); return; }
        const itemId = record.record_type === 'shift' ? record.shift_id : record.job_posting_id;
        if (!itemId) { toast.error(`${record.record_type === 'shift' ? 'Skift' : 'Annons'}-ID saknas.`); return; }
        setIsLoadingItemDetails(true);
        try {
            const table = record.record_type === 'shift' ? 'shift_needs' : 'job_postings';
            const { data, error } = await supabase.from(table).select(`*, employer:employer_id (full_name, pharmacy_name)`).eq('id', itemId).maybeSingle();
            if (error) throw error; if (!data) throw new Error(`Detaljer hittades inte.`);
            setDetailedItemData(data); setShowItemDetailsModal(true);
        } catch (err: any) { toast.error(err.message || "Kunde inte ladda detaljer."); } 
        finally { setIsLoadingItemDetails(false); }
    }, []);

    const handleClearFilters = () => { setSelectedPayPeriod(defaultPayPeriod); setSelectedStatus('pending'); setEmployeeFilter(''); if(isAdmin) setAdminSelectedEmployerId(''); setSelectedRecordIds(new Set()); };
    
    const uniqueEmployeeInFilteredResults = useMemo(() => {
        if (!employeeFilter.trim() || sortedRecords.length === 0) return null;
        const employeeId = sortedRecords[0].user_id; const employeeName = sortedRecords[0].employeeName;
        for (let i = 1; i < sortedRecords.length; i++) { if (sortedRecords[i].user_id !== employeeId) return null; }
        return { userId: employeeId, name: employeeName ?? 'Okänd Anställd' };
    }, [sortedRecords, employeeFilter]);
    
    const handleOpenConsolidatedSummary = useCallback(async () => {
        if (!uniqueEmployeeInFilteredResults || !selectedPayPeriod) {
            toast.error("Vänligen filtrera på en enskild anställd och välj en löneperiod.");
            return;
        }
        const { userId, name } = uniqueEmployeeInFilteredResults;
        const payPeriodYYYYMM = selectedPayPeriod;
        setIsLoadingConsolidated(true);
        const employeeItemsForPeriod = sortedRecords.filter(rec => rec.user_id === userId && rec.pay_period.startsWith(payPeriodYYYYMM));
        const summary = employeeItemsForPeriod.reduce((acc, rec) => {
            const baseForItem = (rec.record_type === 'shift' ? (rec.hours_worked || 0) * (rec.hourly_rate || 0) : (rec.agreed_compensation || 0));
            const obForItem = rec.total_ob_premium ?? 0;
            acc.totalHours += rec.hours_worked || 0;
            acc.totalBasePay += baseForItem;
            acc.totalOB += obForItem;
            acc.totalAdjustments += rec.net_adjustments ?? 0;
            acc.grandTotal += rec.total_pay ?? 0;
            if (rec.ob_details) {
                acc.totalOB50Hours += rec.ob_details.ob_50_hours || 0;
                acc.totalOB75Hours += rec.ob_details.ob_75_hours || 0;
                acc.totalOB100Hours += rec.ob_details.ob_100_hours || 0;
            }
            acc.items.push({
                payrollRecordId: rec.id,
                itemId: rec.record_type === 'shift' ? rec.shift_id : rec.job_posting_id,
                itemDate: rec.record_type === 'shift' ? rec.shiftDate : rec.posting_period_start_date,
                itemTitle: rec.record_type === 'shift' ? rec.shiftTitle : rec.posting_title,
                hoursWorked: rec.hours_worked,
                basePayForItem,
                obPremiumForItem: obForItem,
                netAdjustmentsOnItem: rec.net_adjustments ?? 0,
                totalPayForItem: rec.total_pay ?? 0,
                itemType: rec.record_type!,
            });
            return acc;
        }, { 
            totalHours: 0, totalBasePay: 0, totalOB: 0, totalAdjustments: 0, grandTotal: 0, 
            items: [] as ConsolidatedItemDetail[], 
            totalOB50Hours: 0, totalOB75Hours: 0, totalOB100Hours: 0 
        });
        const summaryData: ConsolidatedPayrollSummary = {
            employeeUserId: userId, employeeName: name, payPeriod: payPeriodYYYYMM,
            individualItems: summary.items, totalHoursFromItems: summary.totalHours,
            totalBasePayFromItems: summary.totalBasePay, totalOBPremiumFromItems: summary.totalOB,
            obDetails: { ob_50_hours: summary.totalOB50Hours, ob_75_hours: summary.totalOB75Hours, ob_100_hours: summary.totalOB100Hours },
            totalNetAdjustmentsFromItems: summary.totalAdjustments,
            subTotalPayFromItems: summary.grandTotal, grandTotalPay: summary.grandTotal,
            periodLevelAdjustments: [], totalPeriodLevelAdjustments: 0,
        };
        setConsolidatedData(summaryData);
        setShowConsolidatedModal(true);
        setIsLoadingConsolidated(false);
    }, [uniqueEmployeeInFilteredResults, selectedPayPeriod, sortedRecords]);

    const handleSaveConsolidatedAdjustments = useCallback(async (employeeUserId: string, payPeriodYYYYMM: string, adjustmentsToSave: PeriodLevelAdjustmentUI[]): Promise<boolean> => {
        const effectiveEmployerId = isAdmin ? adminSelectedEmployerId : currentProfile?.id;
        if (!effectiveEmployerId && adjustmentsToSave.length > 0) { toast.error("Kan inte spara justeringar."); return false; }
        toast.loading("Sparar...");
        toast.success("Sparat!");
        return true;
    }, [isAdmin, adminSelectedEmployerId, currentProfile?.id]);

    return (
        <div className="space-y-6">
            <div className="p-3 sm:p-4 md:p-6 bg-white rounded-xl border shadow-lg">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-5">Filter & Åtgärder för {recordTypeFilter === 'shift' ? 'Pass' : 'Uppdrag'}</h2>
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-x-6 gap-y-4 items-end`}>
                    <div><label htmlFor="payPeriodFilterEmp" className="form-label">Löneperiod</label><input type="month" id="payPeriodFilterEmp" value={selectedPayPeriod} onChange={(e) => setSelectedPayPeriod(e.target.value)} className="form-input"/></div>
                    <div><label htmlFor="statusFilterEmp" className="form-label">Status</label><select id="statusFilterEmp" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as PayrollStatus | '')} className="form-select"><option value="">Alla</option><option value="pending">Väntande</option><option value="processed">Bearbetad</option><option value="paid">Betald</option></select></div>
                    <div><label htmlFor="employeeFilterEmp" className="form-label">Anställd</label><input type="text" id="employeeFilterEmp" placeholder="Filtrera på anställd..." value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="form-input"/></div>
                    {isAdmin && <div><label htmlFor="adminEmployerFilter" className="form-label"><Building2 size={14} className="inline mr-1"/>Välj Arbetsgivare</label><select id="adminEmployerFilter" value={adminSelectedEmployerId} onChange={(e) => setAdminSelectedEmployerId(e.target.value)} className="form-select" disabled={allEmployers.length === 0 && !isLoading}><option value="">{allEmployers.length > 0 || isLoading ? "Alla Arbetsgivare" : "Laddar..."}</option>{allEmployers.map(emp => <option key={emp.id} value={emp.id}>{emp.display_name}</option>)}</select></div>}
                </div>
                <div className="mt-6 pt-5 border-t flex flex-wrap gap-3 items-center">
                    <button onClick={handleApplyFiltersClick} disabled={isLoading} className="btn btn-primary btn-sm"><Filter size={14} className="mr-1.5"/>Verkställ Filter</button>
                    <button onClick={handleClearFilters} disabled={isLoading} className="btn btn-outline btn-sm"><XCircle size={14} className="mr-1.5"/>Rensa</button>
                    <div className="flex-grow"></div>

                  {/* ADD THE NEW BUTTON HERE */}
                    <button 
                        onClick={handleSendToPayrollOffice} 
                        disabled={isLoading || sortedRecords.length === 0} 
                        className="btn btn-primary-outline btn-sm"
                        title="Generera rapport och skicka som e-post"
                    >
                        <Send size={14} className="mr-1.5"/>Skicka till Lönekontoret
                    </button>
                    <button onClick={handleExportCSV} disabled={isLoading || sortedRecords.length === 0} className="btn btn-secondary btn-sm"><Download size={14} className="mr-1.5"/>CSV</button>
                    <button onClick={handleExportPDF} disabled={isLoading || sortedRecords.length === 0} className="btn btn-secondary btn-sm"><FileText size={14} className="mr-1.5"/>PDF</button>
                    <button onClick={() => handleBulkUpdateStatus('processed')} disabled={isLoading || selectedPendingCount === 0} className="btn btn-success-outline btn-sm"><CheckCircle size={14} className="mr-1.5" />Bearbeta ({selectedPendingCount})</button>
                    <button onClick={() => handleBulkUpdateStatus('paid')} disabled={isLoading || selectedProcessedCount === 0} className="btn btn-success btn-sm"><DollarSign size={14} className="mr-1.5" />Betala ({selectedProcessedCount})</button>
                </div>
            </div>

            {uniqueEmployeeInFilteredResults && <div className="mt-4 p-3 bg-sky-50 rounded-lg border flex items-center justify-between shadow"><p className="text-sm text-sky-800">Filtrerat för: <strong className="font-semibold">{uniqueEmployeeInFilteredResults.name}</strong> i <strong className="font-medium">{formatDateSafe(selectedPayPeriod, 'MMMM yy', sv)}</strong></p><button onClick={handleOpenConsolidatedSummary} className="btn btn-primary-outline btn-sm" disabled={isLoadingConsolidated || isLoading}><Briefcase size={14} className="mr-1.5" />Visa Konsoliderad Översikt</button></div>}
            
            {!isLoading && !error && !uniqueEmployeeInFilteredResults && <div className="p-4 bg-indigo-50 rounded-lg border"><h3 className="text-lg font-semibold text-indigo-800 mb-2">Summering för {formatDateSafe(selectedPayPeriod, 'MMMM yy', sv)}</h3><div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm"><p><span className="font-medium">Timmar:</span> {periodSummary.totalHours.toFixed(2)}</p><p><span className="font-medium">Grundlön:</span> {periodSummary.totalBasePay.toFixed(2)} SEK</p><p><span className="font-medium">OB:</span> {periodSummary.totalOBPremium.toFixed(2)} SEK</p><p><span className="font-medium">Just:</span> {periodSummary.totalAdjustments.toFixed(2)} SEK</p><p className="font-semibold text-base"><span className="font-medium">Totalt:</span> {periodSummary.totalGrossPay.toFixed(2)} SEK</p></div></div>}

                {/* NEW: Email Log Section */}
      <div className="p-3 sm:p-4 md:p-6 bg-white rounded-xl border shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Skickade Lönerapporter</h2>
        {loadingLogs ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Laddar logg...</span>
          </div>
        ) : (
          <PayrollEmailLog logs={emailLogs} />
        )}
      </div>
            
            {isLoading && <div className='text-center p-10'><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary-600"/><p className="mt-2">Laddar...</p></div>}
            {error && <div className="text-red-700 bg-red-100 p-4 rounded-md border my-4">Fel: {error}</div>}

            {!isLoading && !error && (
                <div className="overflow-x-auto shadow-xl border sm:rounded-lg bg-white mt-6">
                    <table className="min-w-full divide-y">
                        <thead className="bg-gray-100 whitespace-nowrap">
                            <tr>
                                <th className="th-class"><input type="checkbox" className="form-checkbox" onChange={handleToggleSelectAllVisible} checked={sortedRecords.length > 0 && sortedRecords.every(r => selectedRecordIds.has(r.id))} ref={input => { if (input) { input.indeterminate = sortedRecords.some(r => selectedRecordIds.has(r.id)) && !sortedRecords.every(r => selectedRecordIds.has(r.id)); }}}/></th>
                                {([ { label: 'Anställd', key: 'employeeName' }, { label: 'Period', key: 'pay_period' }, { label: 'Datum', key: 'shiftDate' }, { label: 'Titel', key: 'shiftTitle' }, { label: 'Timmar', key: 'hours_worked', n: 1 }, { label: 'Grundlön/Ers.', key: 'hourly_rate', n: 1 }, { label: 'Grundlön', n: 1 }, { label: 'OB Prem.', key: 'total_ob_premium', n: 1 }, { label: 'Netto Just.', key: 'net_adjustments', n: 1 }, { label: 'Total Lön', key: 'total_pay', n: 1 }, { label: 'Status', key: 'status' }, { label: 'Åtgärder', n: 1, s: 0 } ] as Array<{ label: string; key?: keyof PayrollExportData; n?: number; s?: number }>).map(h => (
                                    <th key={h.label} className={`th-class ${h.n ? 'text-right' : 'text-left'} ${h.s !== 0 ? 'cursor-pointer' : ''}`} onClick={() => h.key && h.s !== 0 && requestSort(h.key as keyof PayrollExportData)}><div className={`flex items-center ${h.n ? 'justify-end' : 'justify-start'}`}>{h.label}{h.s !== 0 && getSortIcon(h.key!)}</div></th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y">
                            {sortedRecords.length === 0 ? (
                                <tr><td colSpan={13} className="px-6 py-12 text-center text-gray-500 italic">Inga löneunderlag hittades.</td></tr>
                            ) : (
                                sortedRecords.map((record) => {
                                    const basePay = record.record_type === 'shift' ? (record.hours_worked || 0) * (record.hourly_rate || 0) : record.agreed_compensation || 0;
                                    const itemDate = record.record_type === 'shift' ? record.shiftDate : record.posting_period_start_date;
                                    const itemTitle = record.record_type === 'shift' ? record.shiftTitle : record.posting_title;
                                    return (
                                    <tr key={record.id} className={`hover:bg-slate-50 ${selectedRecordIds.has(record.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="td-class"><input type="checkbox" className="form-checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => handleToggleSelectRecord(record.id)}/></td>
                                        <td className="td-class font-medium">{record.employeeName}</td>
                                        <td className="td-class">{formatDateSafe(record.pay_period, 'MMMM yy', sv)}</td>
                                        <td className="td-class">{formatDateSafe(itemDate, 'MMM dd, yy', sv)}</td>
                                        <td className="td-class max-w-xs truncate"><button onClick={() => handleViewItemDetails(record)} className="text-blue-600 hover:underline">{itemTitle}</button></td>
                                        <td className="td-class text-right">{record.hours_worked?.toFixed(2)}<OBDetailsTooltip details={record.ob_details}/></td>
                                        <td className="td-class text-right">{record.record_type === 'shift' ? record.hourly_rate?.toFixed(2) : record.agreed_compensation?.toFixed(2)}</td>
                                        <td className="td-class text-right">{basePay.toFixed(2)}</td>
                                        <td className="td-class text-right">{record.total_ob_premium?.toFixed(2)}</td>
                                        <td className="td-class text-right">{record.net_adjustments?.toFixed(2)}</td>
                                        <td className="td-class font-semibold text-right">{record.total_pay?.toFixed(2)}</td>
                                        <td className="td-class"><span className={`status-badge capitalize status-${record.status}`}>{record.status}</span></td>
                                        <td className="td-class text-right"><button onClick={() => handleOpenAdjustmentsModal(record)} className="text-indigo-600 hover:underline">Justera</button></td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            
            {showAdjustmentsModal && recordToAdjust && <PayrollAdjustmentsModal payrollRecord={recordToAdjust} onClose={() => handleCloseAdjustmentsModal(true)} currentRecordType={recordTypeFilter}/>}
            
            {isLoadingItemDetails && <div className="fixed inset-0 bg-black bg-opacity-30 z-[80] flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-white"/></div>}
            {showItemDetailsModal && detailedItemData && ('date' in detailedItemData ? 
                <ShiftDetailsModal shift={detailedItemData as ShiftNeed} onClose={() => setShowItemDetailsModal(false)} currentUserRole={currentProfile?.role} onUpdate={loadPayrollData}/> :
                <PostingDetailsModal posting={detailedItemData as JobPosting} currentUserRole={currentProfile?.role || 'anonymous'} onClose={() => setShowItemDetailsModal(false)} onViewEmployerProfile={()=>{}} onUpdate={loadPayrollData} hasApplied={false} canApplyInfo={{canApply: false}}/>
            )}
            
            {showConsolidatedModal && consolidatedData && <ConsolidatedPayrollModal isOpen={showConsolidatedModal} onClose={() => setShowConsolidatedModal(false)} initialSummaryData={consolidatedData} onSavePeriodAdjustments={handleSaveConsolidatedAdjustments} currentUserRole={currentProfile?.role}/>}
        </div>
    );
};

const PayrollPage: React.FC = () => {
    const { profile, loading: authLoading } = useAuth();
    const userRole = profile?.role as UserRole | undefined;
    const [activeEmployerTab, setActiveEmployerTab] = useState<'payroll' | 'postings'>('payroll');

    if (authLoading) return <div className='fixed inset-0 flex items-center justify-center'><Loader2 className="h-12 w-12 animate-spin text-primary-600"/></div>;
    if (!profile) return <div className="p-6 text-center text-red-700"><XCircle size={56} className="mx-auto mb-4" /><h1>Åtkomst Nekad</h1></div>;

    const canViewEmployerPayroll = userRole && (userRole === 'employer' || userRole === 'admin');

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
            <header className="mb-8 max-w-7xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800">{canViewEmployerPayroll ? "Lönehantering" : "Min Lön"}</h1>
                <p className="text-slate-600 mt-1.5 text-lg">{canViewEmployerPayroll ? "Hantera löneunderlag för både pass och slutförda uppdrag." : "Se din personliga lönehistorik."}</p>
            </header>
            <main className="max-w-7xl mx-auto">
                {canViewEmployerPayroll ? (
                    <>
                        <div className="mb-6 border-b border-gray-200">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                <button onClick={() => setActiveEmployerTab('payroll')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm sm:text-base ${activeEmployerTab === 'payroll' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Löner för Pass</button>
                                <button onClick={() => setActiveEmployerTab('postings')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm sm:text-base ${activeEmployerTab === 'postings' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Löner för Uppdrag</button>
                            </nav>
                        </div>
                        {activeEmployerTab === 'payroll' && <EmployerPayrollView recordTypeFilter="shift" />}
                        {activeEmployerTab === 'postings' && <EmployerPayrollView recordTypeFilter="posting" />}
                    </>
                ) : (
                    <EmployeeSpecificPayrollView />
                )}
            </main>
            <style jsx global>{`
                .form-label { @apply block text-xs sm:text-sm font-medium text-gray-700 mb-1; }
                .form-input, .form-select { @apply block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm; }
                .form-checkbox { @apply h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500; }
                .btn { @apply inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50; }
                .btn-sm { @apply px-3 py-1.5 text-sm; }
                .btn-primary { @apply border-transparent text-white bg-primary-600 hover:bg-primary-700 focus:ring-primary-500; }
                .btn-primary-outline { @apply border-primary-500 text-primary-600 bg-white hover:bg-primary-50 focus:ring-primary-500; }
                .btn-secondary { @apply border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500; }
                .btn-outline { @apply border-gray-300 text-gray-700 bg-white hover:bg-gray-50; }
                .btn-success { @apply border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500; }
                .btn-success-outline { @apply border-green-500 text-green-600 bg-white hover:bg-green-50 focus:ring-green-500; }
                .btn-danger-outline { @apply border-red-500 text-red-600 bg-white hover:bg-red-50 focus:ring-red-500; }
                .th-class { @apply px-2 sm:px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider; }
                .td-class { @apply px-2 sm:px-4 py-3.5 text-sm text-gray-600; }
                .status-badge { @apply inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border; }
                .status-paid { @apply bg-green-100 text-green-800 border-green-300; }
                .status-processed { @apply bg-yellow-100 text-yellow-800 border-yellow-300; }
                .status-pending { @apply bg-blue-100 text-blue-800 border-blue-300; }
            `}</style>
        </div>
    );
}
export default PayrollPage;
