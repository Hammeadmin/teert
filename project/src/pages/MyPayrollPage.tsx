// src/pages/MyPayrollPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchMyPayrollRecords, PayrollExportData } from '../lib/payroll';
import toast from 'react-hot-toast';
import { Loader2, Info, ListFilter, ChevronUp, ChevronDown, Archive, XCircle, Building2 as EmployerIcon, Briefcase, CalendarCheck, ClipboardList } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import { format, parseISO, isValid, Locale } from 'date-fns';
import { sv } from 'date-fns/locale';
import { EmployerProfileViewModal } from '../components/employer/EmployerProfileViewModal';
import { ShiftDetailsModal } from '../components/Shifts/ShiftDetailsModal';
import { PostingDetailsModal } from '../components/postings/PostingDetailsModal';
import { ConsolidatedPayrollModal, ConsolidatedItemDetail, ConsolidatedPayrollSummary } from '../components/Payroll/ConsolidatedPayrollModal';
import type { UserRole, ShiftNeed, JobPosting } from '../types';
import { supabase } from '../lib/supabase';

type SortDirection = 'ascending' | 'descending';
interface SortConfig<T> {
    key: keyof T | null;
    direction: SortDirection;
}

const OBDetailsTooltip: React.FC<{ details: any }> = ({ details }) => {
    if (!details || typeof details !== 'object' || Object.keys(details).length === 0) return null;
    
    // ** UPDATED LOGIC TO BE MORE DESCRIPTIVE **
    const obDescriptions = {
        ob_50_hours: "OB 50% (Vardag)",
        ob_75_hours: "OB 75% (Fredag/Lördag)",
        ob_100_hours: "OB 100% (Sön/Helgdag)",
    };

    const formattedDetails = Object.entries(details).map(([key, value]) => {
        if (typeof value === 'number' && value > 0 && key in obDescriptions) {
            return `${obDescriptions[key as keyof typeof obDescriptions]}: ${value.toFixed(2)} tim`;
        }
        return null;
    }).filter(Boolean).join(' | ');
    
    if (!formattedDetails) return null;

    return (
        <span className="group relative ml-1.5 inline-block align-middle">
            <Info size={13} className="text-blue-500 cursor-help" />
            <span className="absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 whitespace-nowrap z-20 shadow-lg">
                {formattedDetails}
            </span>
        </span>
    );
};


const formatDateSafe = (dateString: string | null | undefined, formatStr: string = 'PP', locale: Locale = sv): string => {
    if (!dateString) return 'N/A';
    let dateObj: Date | null = null;
    try {
        if (/^\d{4}-\d{2}$/.test(dateString)) {
            dateObj = parseISO(`${dateString}-01`);
        } else {
            dateObj = parseISO(dateString);
        }
        if (!isValid(dateObj)) dateObj = null;
    } catch (e) {
        dateObj = null;
    }
    if (!dateObj) return 'Ogiltigt Datum';
    return format(dateObj, formatStr, { locale });
};

const EmployeeSpecificPayrollView: React.FC = () => {
    const { profile, loading: authLoading } = useAuth();
    const [myPayrollRecords, setMyPayrollRecords] = useState<PayrollExportData[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<PayrollExportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig<PayrollExportData>>({ key: 'pay_period', direction: 'descending' });
    const [activeTab, setActiveTab] = useState<'shift' | 'posting'>('shift');
    const [isEmployerModalOpen, setIsEmployerModalOpen] = useState(false);
    const [selectedEmployerIdForModal, setSelectedEmployerIdForModal] = useState<string | null>(null);
    const [isItemDetailsModalOpen, setIsItemDetailsModalOpen] = useState(false);
    const [detailedItemData, setDetailedItemData] = useState<ShiftNeed | JobPosting | null>(null);
    const [isLoadingItemDetails, setIsLoadingItemDetails] = useState(false);
    const [selectedPayPeriod, setSelectedPayPeriod] = useState<string>('');
    const [isConsolidatedModalOpen, setIsConsolidatedModalOpen] = useState(false);
    const [consolidatedData, setConsolidatedData] = useState<ConsolidatedPayrollSummary | null>(null);
    const [isLoadingConsolidated, setIsLoadingConsolidated] = useState(false);

    const availablePayPeriods = useMemo(() => {
        const periods = new Set(myPayrollRecords.map(r => r.pay_period).filter(Boolean));
        return Array.from(periods).sort().reverse();
    }, [myPayrollRecords]);

    useEffect(() => {
        const result = myPayrollRecords.filter(record => {
            const periodMatch = !selectedPayPeriod || record.pay_period === selectedPayPeriod;
            const tabMatch = record.record_type === activeTab;
            return periodMatch && tabMatch;
        });
        setFilteredRecords(result);
    }, [selectedPayPeriod, myPayrollRecords, activeTab]);
    
    const loadMyData = useCallback(async () => {
        if (!profile) return;
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await fetchMyPayrollRecords();
            if (fetchError) throw new Error(fetchError as string);
            setMyPayrollRecords(data || []);
            if (data && data.length > 0) {
                const periods = Array.from(new Set(data.map(r => r.pay_period).filter(Boolean))).sort().reverse();
                if (periods.length > 0 && selectedPayPeriod === '') {
                    setSelectedPayPeriod(periods[0]);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Ett oväntat fel inträffade.');
            toast.error(err.message || 'Kunde inte ladda lönedata.');
        } finally {
            setIsLoading(false);
        }
    }, [profile, selectedPayPeriod]);


    useEffect(() => {
        if (!authLoading) {
            loadMyData();
        }
    }, [authLoading, loadMyData]);

    const handleOpenItemDetailsModal = useCallback(async (record: PayrollExportData) => {
        setIsLoadingItemDetails(true);
        setIsItemDetailsModalOpen(true);
        try {
            const table = record.record_type === 'shift' ? 'shift_needs' : 'job_postings';
            const id = record.record_type === 'shift' ? record.shift_id : record.job_posting_id;
            if (!id) throw new Error("Posten saknar nödvändigt ID.");
            const { data, error } = await supabase.from(table).select('*,employer:employer_id(*)').eq('id', id).single();
            if (error) throw error;
            setDetailedItemData(data);
        } catch (err: any) {
            toast.error(err.message || "Kunde inte hämta detaljerad information.");
            setIsItemDetailsModalOpen(false);
        } finally {
            setIsLoadingItemDetails(false);
        }
    }, []);

    const requestSort = (key: keyof PayrollExportData) => {
        setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const getSortIcon = (key: keyof PayrollExportData) => {
        if (sortConfig.key !== key) return <ListFilter size={14} className="ml-1 opacity-40" />;
        return sortConfig.direction === 'ascending' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
    };

    const sortedRecords = useMemo(() => {
        let sortableItems = [...filteredRecords];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key!];
                const bValue = b[sortConfig.key!];
                if (aValue == null) return 1;
                if (bValue == null) return -1;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
                }
                return String(aValue).localeCompare(String(bValue)) * (sortConfig.direction === 'ascending' ? 1 : -1);
            });
        }
        return sortableItems;
    }, [filteredRecords, sortConfig]);

    // ** UPDATED to calculate detailed OB totals **
    const handleOpenConsolidatedSummary = useCallback(() => {
        if (!selectedPayPeriod) return toast.error("Välj en löneperiod.");
        setIsLoadingConsolidated(true);
        
        const itemsForPeriod = myPayrollRecords.filter(rec => rec.pay_period === selectedPayPeriod);
        if (itemsForPeriod.length === 0) {
            setIsLoadingConsolidated(false);
            return toast.error(`Inga poster för ${formatDateSafe(selectedPayPeriod, 'MMMM yyyy', sv)}.`);
        }

        const summary = itemsForPeriod.reduce((acc, rec) => {
            const baseForItem = (rec.record_type === 'shift' ? (rec.hours_worked || 0) * (rec.hourly_rate || 0) : (rec.agreed_compensation || 0));
            const obForItem = rec.total_ob_premium ?? 0;
            const adjForItem = rec.net_adjustments ?? 0;
            
            acc.totalHours += rec.hours_worked || 0;
            acc.totalBasePay += baseForItem;
            acc.totalOB += obForItem;
            acc.totalAdjustments += adjForItem;
            acc.grandTotal += rec.total_pay ?? 0;
            
            // Add detailed OB hours to the accumulator
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
                basePayForItem: baseForItem,
                obPremiumForItem: obForItem,
                netAdjustmentsOnItem: adjForItem,
                totalPayForItem: rec.total_pay ?? 0,
                itemType: rec.record_type!,
            });
            return acc;
        }, { 
            totalHours: 0, totalBasePay: 0, totalOB: 0, totalAdjustments: 0, grandTotal: 0, 
            items: [] as ConsolidatedItemDetail[],
            totalOB50Hours: 0, totalOB75Hours: 0, totalOB100Hours: 0 // New accumulators
        });

        setConsolidatedData({
            employeeUserId: profile!.id,
            employeeName: profile!.full_name || 'Okänd',
            payPeriod: selectedPayPeriod,
            individualItems: summary.items,
            totalHoursFromItems: summary.totalHours,
            totalBasePayFromItems: summary.totalBasePay,
            totalOBPremiumFromItems: summary.totalOB,
            // Add the detailed OB breakdown to the summary data
            obDetails: {
                ob_50_hours: summary.totalOB50Hours,
                ob_75_hours: summary.totalOB75Hours,
                ob_100_hours: summary.totalOB100Hours,
            },
            totalNetAdjustmentsFromItems: summary.totalAdjustments,
            subTotalPayFromItems: summary.grandTotal,
            grandTotalPay: summary.grandTotal,
            periodLevelAdjustments: [],
            totalPeriodLevelAdjustments: 0,
        });
        setIsConsolidatedModalOpen(true);
        setIsLoadingConsolidated(false);
    }, [selectedPayPeriod, myPayrollRecords, profile]);
    
    if (isLoading) return <div className='text-center p-10'><Loader2 className="h-10 w-10 animate-spin" /></div>;
    if (error) return <div className="p-4 my-4 text-red-700 bg-red-100 border rounded-md">Fel: {error}</div>;

    return (
        <main className="max-w-7xl mx-auto">
              <div className="p-4 bg-white rounded-lg shadow-md border mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      <div>
                          <label htmlFor="payPeriodSelect" className="block text-sm font-medium text-gray-700 mb-1">Löneperiod</label>
                          <select id="payPeriodSelect" value={selectedPayPeriod} onChange={e => setSelectedPayPeriod(e.target.value)} className="form-select w-full">
                              <option value="">Alla Perioder</option>
                              {availablePayPeriods.map(period => (
                                  <option key={period} value={period}>{formatDateSafe(period, 'MMMM yyyy', sv)}</option>
                              ))}
                          </select>
                      </div>
                      <div className="flex justify-end">
                          <button onClick={handleOpenConsolidatedSummary} disabled={!selectedPayPeriod || isLoadingConsolidated} className="btn btn-primary w-full md:w-auto">
                              {isLoadingConsolidated ? <Loader2 size={16} className="animate-spin mr-2" /> : <Briefcase size={16} className="mr-2" />}
                              Visa Månadsöversikt
                          </button>
                      </div>
                  </div>
              </div>

              <div className="mb-6 border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                      <button onClick={() => setActiveTab('shift')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'shift' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                          <CalendarCheck size={16} className="inline-block mr-2" /> Mina Pass
                      </button>
                      <button onClick={() => setActiveTab('posting')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'posting' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                          <ClipboardList size={16} className="inline-block mr-2" /> Mina Uppdrag
                      </button>
                  </nav>
              </div>

              {sortedRecords.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg shadow-md border"><Archive size={48} className="mx-auto text-gray-400 mb-4" /><h3>Inga underlag för {activeTab === 'shift' ? 'pass' : 'uppdrag'} i vald period</h3></div>
              ) : (
                  <div className="overflow-x-auto shadow-xl border sm:rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                              <tr>
                                  {([
                                      { label: 'Datum', key: 'shiftDate' as keyof PayrollExportData },
                                      { label: activeTab === 'shift' ? 'Pass / Arbetsgivare' : 'Uppdrag / Arbetsgivare', key: 'shiftTitle' as keyof PayrollExportData },
                                      { label: 'Timmar', key: 'hours_worked' as keyof PayrollExportData, numeric: true },
                                      { label: 'Grundlön/Ers.', key: 'hourly_rate' as keyof PayrollExportData, numeric: true },
                                      { label: 'OB-tillägg', key: 'total_ob_premium' as keyof PayrollExportData, numeric: true },
                                      { label: 'Justeringar', key: 'net_adjustments' as keyof PayrollExportData, numeric: true },
                                      { label: 'Total Lön', key: 'total_pay' as keyof PayrollExportData, numeric: true },
                                      { label: 'Status', key: 'status' as keyof PayrollExportData },
                                  ] as Array<{ label: string; key?: keyof PayrollExportData; numeric?: boolean }>).map(header => (
                                      <th key={header.label} className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider ${header.numeric ? 'text-right' : 'text-left'} ${header.key ? 'cursor-pointer' : ''}`} onClick={() => header.key && requestSort(header.key)}>
                                          <div className={`flex items-center ${header.numeric ? 'justify-end' : 'justify-start'}`}>{header.label}{header.key && getSortIcon(header.key)}</div>
                                      </th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y">
                              {sortedRecords.map((record) => {
                                  const basePayDisplay = record.record_type === 'shift' 
                                      ? `${(record.hourly_rate || 0).toFixed(2)} SEK/h` 
                                      : `${(record.agreed_compensation || 0).toFixed(2)} SEK`;
                                  return (
                                  <tr key={record.id} className="hover:bg-slate-50">
                                      <td className="cell-class whitespace-nowrap">{formatDateSafe(record.record_type === 'shift' ? record.shiftDate : record.posting_period_start_date, 'MMM dd, yy', sv)}</td>
                                      <td className="cell-class">
                                          <button onClick={() => handleOpenItemDetailsModal(record)} className="font-medium text-blue-600 hover:underline">{record.record_type === 'shift' ? record.shiftTitle : record.posting_title}</button>
                                          {record.employer_name && <div className="text-xs text-gray-500 mt-1 flex items-center"><EmployerIcon size={12} className="mr-1.5" />{record.employer_name}</div>}
                                      </td>
                                      <td className="cell-class text-right">{record.hours_worked?.toFixed(2) ?? 'N/A'}<OBDetailsTooltip details={record.ob_details} /></td>
                                      <td className="cell-class text-right">{basePayDisplay}</td>
                                      <td className="cell-class text-right">{record.total_ob_premium?.toFixed(2) ?? '0.00'}</td>
                                      <td className="cell-class text-right">{record.net_adjustments?.toFixed(2) ?? '0.00'}</td>
                                      <td className="cell-class font-semibold text-right">{record.total_pay?.toFixed(2) ?? '0.00'}</td>
                                      <td className="cell-class"><span className={`status-badge-sm capitalize status-${record.status}`}>{record.status}</span></td>
                                  </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              )}
              
              {isEmployerModalOpen && <EmployerProfileViewModal isOpen={isEmployerModalOpen} onClose={() => setIsEmployerModalOpen(false)} employerId={selectedEmployerIdForModal} />}
              
              {isItemDetailsModalOpen && (
                   isLoadingItemDetails ? (
                       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"><Loader2 className="h-10 w-10 animate-spin text-white" /></div>
                   ) : detailedItemData ? (
                       'date' in detailedItemData ? // Simple check if it's a shift
                       <ShiftDetailsModal shift={detailedItemData as ShiftNeed} onClose={() => setIsItemDetailsModalOpen(false)} currentUserRole={profile?.role} onUpdate={loadMyData} />
                       : <PostingDetailsModal posting={detailedItemData as JobPosting} currentUserRole={profile?.role || 'anonymous'} onClose={() => setIsItemDetailsModalOpen(false)} hasApplied={false} onUpdate={loadMyData} canApplyInfo={{canApply: false}} onViewEmployerProfile={() => {}} />
                   ) : null
              )}

              {isConsolidatedModalOpen && consolidatedData && (
                  <ConsolidatedPayrollModal
                      isOpen={isConsolidatedModalOpen}
                      onClose={() => setIsConsolidatedModalOpen(false)}
                      initialSummaryData={consolidatedData}
                      currentUserRole={profile?.role}
                      onSavePeriodAdjustments={async () => {
                          toast.error("Funktion ej tillgänglig.");
                          return false;
                      }}
                  />
              )}
        </main>
    );
};

const MyPayrollPage: React.FC = () => {
    const { profile, loading: authLoading } = useAuth();

    if (authLoading) return <div className='fixed inset-0 flex items-center justify-center'><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    if (!profile) return <div className="p-6 text-center text-red-700"><XCircle size={56} className="mx-auto mb-4" /><h1>Åtkomst Nekad</h1><p>Du måste vara inloggad.</p></div>;

    const isActualEmployee = ['pharmacist', 'säljare', 'egenvårdsrådgivare'].includes(profile.role as UserRole);
    
    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
            <header className="mb-8 max-w-7xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800">Min Lön</h1>
                <p className="text-slate-600 mt-1.5 text-lg">Visa din lönehistorik och ladda ner lönebesked.</p>
            </header>
            {isActualEmployee ? <EmployeeSpecificPayrollView /> : <p className="text-center text-gray-600">Du har inte behörighet att visa denna sida.</p>}
            <style jsx>{`
                .form-select { @apply block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm; }
                .btn { @apply inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50; }
                .btn-primary { @apply border-transparent text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500; }
                .cell-class { @apply px-4 py-3 text-sm text-gray-600; }
                .status-badge-sm { @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize; }
                .status-paid { @apply bg-green-100 text-green-800 border-green-300; }
                .status-processed { @apply bg-yellow-100 text-yellow-800 border-yellow-300; }
                .status-pending { @apply bg-blue-100 text-blue-800 border-blue-300; }
            `}</style>
        </div>
    );
}

export default MyPayrollPage;