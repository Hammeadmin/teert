import React from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Clock,
  CheckCircle,
  Calendar,
  DollarSign,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { DemoShiftFinder } from '../components/UI/DemoShiftFinder';

export default function ForApotekare() {
  return (
    <div className="bg-gradient-to-br from-primary-50 via-brandBeige to-accent-50 min-h-screen">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center">
         <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Ta kontroll över din karriär
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Upptäck friheten med flexibelt arbete. Vi erbjuder allt från enstaka pass till längre konsultuppdrag, anpassade efter dina önskemål och din livsstil.
          </p>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Fördelar för apotekspersonal</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-primary-50 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 text-primary-600 mb-4 mx-auto">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 text-center mb-2">Flexibel schemaläggning</h3>
              <p className="text-gray-600 text-center">
                Välj pass som passar din livsstil. Arbeta så mycket eller lite som du vill, när du vill.
              </p>
            </div>

            <div className="bg-primary-50 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 text-primary-600 mb-4 mx-auto">
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 text-center mb-2">Konkurrenskraftig lön</h3>
              <p className="text-gray-600 text-center">
                Tjäna konkurrenskraftiga löner med transparenta betalningsprocesser och punktliga utbetalningar.
              </p>
            </div>

            <div className="bg-primary-50 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 text-primary-600 mb-4 mx-auto">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 text-center mb-2">Unika möjligheter</h3>
              <p className="text-gray-600 text-center">
                Arbeta i olika apoteksmiljöer för att få varierad erfarenhet och utöka ditt professionella nätverk.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What We Offer Section - NEW */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Vad vi erbjuder</h2>
            <p className="mt-4 text-lg text-gray-600">
              Möjligheter som passar din expertis och dina ambitioner.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg p-8 shadow-md border border-gray-100">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 text-primary-600 mb-4">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">Enstaka Pass</h3>
              <p className="text-gray-600">
                Perfekt för dig som vill tjäna extra pengar vid sidan av din nuvarande anställning eller studier. Ta ett morgonpass, helgpass eller hoppa in vid akuta behov. Du bestämmer själv när och hur ofta du vill arbeta.
              </p>
            </div>
            <div className="bg-white rounded-lg p-8 shadow-md border border-gray-100">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 text-primary-600 mb-4">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">Längre Uppdrag</h3>
              <p className="text-gray-600">
                Söker du mer stabilitet? Ta dig an längre konsultuppdrag, sommarvikariat eller projektanställningar. En utmärkt möjlighet att utveckla dina färdigheter i en ny miljö.
              </p>
            </div>
          </div>
        </div>
      </div>

            {/* Interactive Demo Section - NEW */}
      <div className="py-16 bg-primary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 lg:pr-8">
                <DemoShiftFinder />
              </div>
              <div className="order-1 lg:order-2 text-center lg:text-left">
                <h3 className="text-2xl font-semibold text-gray-800">Upptäck & Ansök på Minuter</h3>
                <p className="mt-2 text-gray-600">
                  Vår plattform gör det enkelt att hitta arbetspass som passar dig. Sök baserat på plats, filtrera på typ av roll och ansök med ett enda klick. Se hur smidigt det fungerar i vår interaktiva demo.
                </p>
              </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section - NEW */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Vad våra kollegor säger</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-primary-50 p-8 rounded-lg shadow-sm">
              <p className="text-gray-700 italic">"Farmispoolen gav mig friheten att själv styra mitt schema. Jag kan nu kombinera mitt jobb med mina studier på ett sätt som aldrig var möjligt tidigare. Plattformen är otroligt enkel att använda!"</p>
              <div className="mt-4 flex items-center">
                <img className="h-12 w-12 rounded-full object-cover" src="https://i.pravatar.cc/150?u=a042581f4e29026704f"  alt="Maria Larsson" />
                <div className="ml-4">
                  <div className="text-base font-medium text-gray-900">Maria Larsson</div>
                  <div className="text-sm text-gray-500">Leg. Receptarie, Göteborg</div>
                </div>
              </div>
            </div>
            <div className="bg-primary-50 p-8 rounded-lg shadow-sm">
              <p className="text-gray-700 italic">"Jag var tveksam till bemanningsföretag först, men Farmispoolen är annorlunda. Processen är transparent, lönen är konkurrenskraftig och jag får möjlighet att arbeta på olika typer av apotek, vilket är väldigt utvecklande."</p>
              <div className="mt-4 flex items-center">
                <img className="h-12 w-12 rounded-full object-cover" src="https://i.pravatar.cc/150?u=a042581f4e29026704e" alt="Erik Ceder" />
                <div className="ml-4">
                  <div className="text-base font-medium text-gray-900">Erik Ceder</div>
                  <div className="text-sm text-gray-500">Egenvårdsrådgivare, Malmö</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Hur det fungerar</h2>
            <p className="mt-4 text-lg text-gray-600">
              Att komma igång är enkelt och okomplicerat
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-600 text-white font-bold text-lg mb-4 mx-auto">
                1
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Skapa din profil</h3>
              <p className="text-gray-600 text-center">
                Registrera dig och fyll i din professionella profil med dina kvalifikationer och erfarenhet.
              </p>
            </div>

             <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-600 text-white font-bold text-lg mb-4 mx-auto">
                2
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Bli Verifierad</h3>
              <p className="text-gray-600 text-center">
                Ladda upp din legitimation direkt på plattformen. Egenvårdsrådgivare och kassapersonal verifieras automatiskt efter en fullständigt ifylld profil.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-600 text-white font-bold text-lg mb-4 mx-auto">
                3
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Ansök om pass</h3>
              <p className="text-gray-600 text-center">
                Bläddra bland tillgängliga pass och ansök med ett enda klick till de som intresserar dig.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-600 text-white font-bold text-lg mb-4 mx-auto">
                4
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Arbeta & få betalt</h3>
              <p className="text-gray-600 text-center">
                Slutför dina pass och få betalning direkt genom vår säkra plattform.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Roles Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Roller vi stödjer</h2>
            <p className="mt-4 text-lg text-gray-600">
              Farmispoolen kopplar samman apotek med olika apotekspersonal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-primary-50 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-medium text-gray-900 text-center mb-4">Farmaceut</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Legitimerade farmaceuter för recepthantering</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Läkemedelsgenomgång och patientrådgivning</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Apotekshantering och övervakning</span>
                </li>
              </ul>
            </div>

            <div className="bg-primary-50 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-medium text-gray-900 text-center mb-4">Egenvårdsrådgivare</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Receptfria läkemedelsråd och rekommendationer</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Kundernas hälsokonsultationer</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Produktkunskap och hälsoråd</span>
                </li>
              </ul>
            </div>

            <div className="bg-primary-50 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-medium text-gray-900 text-center mb-4">Säljare</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Butiksförsäljning och kundservice</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Kassahantering och lagerhantering</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-accent-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Produktexponering och butiksutformning</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white">
            Redo att hitta ditt nästa apotekspass?
          </h2>
          <p className="mt-4 text-xl text-primary-100 max-w-2xl mx-auto">
            Gå med tusentals apotekspersonal som redan använder Farmispoolen
          </p>
          <div className="mt-8">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-primary-50 shadow-md transition-colors"
            >
              Skapa Din Profil
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}