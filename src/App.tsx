import React, { useState, useMemo } from 'react';
import { simulate, SimulatorParams } from './lib/simulator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Calculator, TrendingUp, Building, Wallet, Settings2, ChevronDown, ChevronUp, Info, Home } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_PARAMS: SimulatorParams = {
  propertyPrice: 200000,
  works: 20000,
  notaryFeesRate: 8,
  apport: 50000,
  rent: 1100,
  loanDurationYears: 20,
  simulationDurationYears: 30,
  loanRate: 3.5,
  insuranceRate: 0.3,
  loanType: 'amortissable',
  apportUsage: 'injecte',
  taxRegime: 'lmnp-reel',
  tmi: 30,
  stockReturn: 4,
  pledgedReturn: 4,
  propertyAppreciation: 1.5,
  rentAppreciation: 1.5,
  inflation: 2,
  propertyTax: 1200,
  managementFeesRate: 7,
  pnoInsurance: 150,
  vacancyRate: 5,
  maintenanceRate: 1,
  rentStartMonth: 1,
};

export default function App() {
  const [params, setParams] = useState<SimulatorParams>(DEFAULT_PARAMS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState<'year' | 'month'>('year');
  const [tableViewMode, setTableViewMode] = useState<'year' | 'month'>('year');
  const [resaleYear, setResaleYear] = useState<number>(DEFAULT_PARAMS.loanDurationYears);

  const { yearlyData, monthlyData } = useMemo(() => simulate(params), [params]);
  const data = yearlyData;
  const chartData = viewMode === 'year' ? yearlyData : monthlyData;

  const resaleData = useMemo(() => {
    const actualResaleYear = Math.min(Math.max(1, resaleYear), params.simulationDurationYears);
    const notaryFees = params.propertyPrice * (params.notaryFeesRate / 100);
    const acquisitionPrice = params.propertyPrice + params.works + notaryFees;
    const salePrice = (params.propertyPrice + params.works) * Math.pow(1 + params.propertyAppreciation / 100, actualResaleYear);
    
    let grossPlusValue = salePrice - acquisitionPrice;
    if (grossPlusValue < 0) grossPlusValue = 0;

    let taxAcquisitionCosts = notaryFees;
    let taxWorks = params.works;
    
    if (actualResaleYear > 5) {
      taxAcquisitionCosts = Math.max(notaryFees, params.propertyPrice * 0.075);
      taxWorks = Math.max(params.works, params.propertyPrice * 0.15);
    }
    
    const acquisitionPriceForTax = params.propertyPrice + taxAcquisitionCosts + taxWorks;
    let taxableGrossPlusValue = salePrice - acquisitionPriceForTax;
    if (taxableGrossPlusValue < 0) taxableGrossPlusValue = 0;

    let taxIR = 0;
    let taxPS = 0;
    let totalTax = 0;

    if (params.taxRegime === 'sci-is') {
      const amortPerYear = (params.propertyPrice * 0.8) / 30;
      const totalAmort = amortPerYear * actualResaleYear;
      let vnc = acquisitionPrice - totalAmort;
      if (vnc < 0) vnc = 0;
      const pvIS = salePrice - vnc;
      if (pvIS > 0) {
        totalTax = pvIS <= 42500 ? pvIS * 0.15 : (42500 * 0.15 + (pvIS - 42500) * 0.25);
      }
    } else {
      let abattementIR = 0;
      for (let y = 6; y <= actualResaleYear; y++) {
        if (y <= 21) abattementIR += 6;
        else if (y === 22) abattementIR += 4;
      }

      let abattementPS = 0;
      for (let y = 6; y <= actualResaleYear; y++) {
        if (y <= 21) abattementPS += 1.65;
        else if (y === 22) abattementPS += 1.6;
        else if (y <= 30) abattementPS += 9;
      }

      const baseIR = taxableGrossPlusValue * (1 - Math.min(100, abattementIR) / 100);
      const basePS = taxableGrossPlusValue * (1 - Math.min(100, abattementPS) / 100);

      taxIR = baseIR * 0.19;
      taxPS = basePS * 0.172;
      totalTax = taxIR + taxPS;
    }

    const yearData = data[actualResaleYear - 1];
    const loanBalance = yearData.loanBalance;
    const netSeller = salePrice - totalTax - loanBalance;
    
    const reInvestedCash = yearData.reWealth - yearData.propertyValue + yearData.loanBalance;

    const totalImmo = netSeller + reInvestedCash;
    const totalStock = yearData.stockWealth;
    
    // Calculate total out of pocket up to the resale year
    const totalOutOfPocketResale = data.slice(0, actualResaleYear).reduce((acc, year) => acc + year.outOfPocket, 0);

    return {
      actualResaleYear,
      acquisitionPrice,
      salePrice,
      grossPlusValue,
      totalTax,
      loanBalance,
      netSeller,
      reInvestedCash,
      totalImmo,
      totalStock,
      totalOutOfPocketResale,
      winner: totalImmo > totalStock ? 'Immobilier' : 'Obligation',
      diff: Math.abs(totalImmo - totalStock)
    };
  }, [params, resaleYear, data]);

  const finalYear = data[data.length - 1];
  const winner = finalYear.reWealth > finalYear.stockWealth ? 'Immobilier' : 'Obligation';
  const diff = Math.abs(finalYear.reWealth - finalYear.stockWealth);
  const totalOutOfPocket = data.reduce((acc, year) => acc + year.outOfPocket, 0);

  const notaryFees = params.propertyPrice * (params.notaryFeesRate / 100);
  const isNanti = params.apportUsage === 'nanti';
  const loanAmount = isNanti ? params.propertyPrice + params.works + notaryFees : Math.max(0, params.propertyPrice + params.works + notaryFees - params.apport);
  const yearlyRent = params.rent * 12;

  const taxWarning = useMemo(() => {
    const totalCost = params.propertyPrice + params.works + notaryFees;
    
    if (params.taxRegime === 'denormandie') {
      if (params.works < 0.25 * totalCost) {
        return { text: "⚠️ Inéligible : Les travaux doivent représenter au moins 25% du coût total de l'opération.", color: "text-rose-600" };
      }
      return { text: "✓ Éligible Denormandie : Réduction d'impôt appliquée (2% pdt 9 ans, puis 1%).", color: "text-emerald-600" };
    }
    if (params.taxRegime === 'micro-foncier' && yearlyRent > 15000) {
      return { text: "⚠️ Inéligible : Les revenus fonciers dépassent le plafond de 15 000 €/an.", color: "text-rose-600" };
    }
    if (params.taxRegime === 'micro-bic' && yearlyRent > 77700) {
      return { text: "⚠️ Inéligible : Les revenus dépassent le plafond de 77 700 €/an.", color: "text-rose-600" };
    }
    if (params.taxRegime === 'locavantages') {
      return { text: "ℹ️ Attention : Soumis à plafonds de loyers et ressources locataire (Simulé: Loc1 -15%).", color: "text-amber-600" };
    }
    return null;
  }, [params.taxRegime, params.propertyPrice, params.works, params.rent, notaryFees]);

  const handleParamChange = (key: keyof SimulatorParams, value: number | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <h1 className="font-semibold text-xl tracking-tight text-slate-900">Simulation Immobilier vs Placement</h1>
          </div>
          <div className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Moteur de calcul France 2026
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Top Section: Inputs & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Main Inputs */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Le Projet Immobilier
              </h2>
              
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Prix du bien" unit="€" value={params.propertyPrice} onChange={(v) => handleParamChange('propertyPrice', v)} />
                  <InputGroup label="Travaux" unit="€" value={params.works} onChange={(v) => handleParamChange('works', v)} />
                  <InputGroup label="Apport initial" unit="€" value={params.apport} onChange={(v) => handleParamChange('apport', v)} />
                  <InputGroup label="Loyer mensuel" unit="€" value={params.rent} onChange={(v) => handleParamChange('rent', v)} />
                  <InputGroup 
                    label="Début des loyers" unit="Mois" 
                    value={params.rentStartMonth} onChange={(v) => handleParamChange('rentStartMonth', v)} step={1}
                    suggestion="Mois 1 = de suite"
                    subtext={params.rentStartMonth > 1 ? `Décalage de ${params.rentStartMonth - 1} mois` : 'Sans décalage'}
                  />
                </div>
                
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Financement</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Durée crédit" unit="ans" value={params.loanDurationYears} onChange={(v) => handleParamChange('loanDurationYears', v)} />
                    <InputGroup label="Durée simulation" unit="ans" value={params.simulationDurationYears} onChange={(v) => handleParamChange('simulationDurationYears', v)} />
                    <InputGroup 
                      label="Taux crédit" 
                      unit="%" 
                      value={params.loanRate} 
                      onChange={(v) => handleParamChange('loanRate', v)} 
                      step={0.1} 
                      suggestion={
                        params.loanType === 'infine' 
                          ? `Moy: ${params.loanDurationYears <= 15 ? '3.6' : params.loanDurationYears <= 20 ? '3.8' : '4.0'}%`
                          : `Moy: ${params.loanDurationYears <= 15 ? '3.3' : params.loanDurationYears <= 20 ? '3.5' : '3.7'}%`
                      }
                    />
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Type de prêt</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                        value={params.loanType}
                        onChange={(e) => handleParamChange('loanType', e.target.value)}
                      >
                        <option value="amortissable">Amortissable</option>
                        <option value="infine">In Fine</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Usage apport</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                        value={params.apportUsage || 'injecte'}
                        onChange={(e) => handleParamChange('apportUsage', e.target.value)}
                      >
                        <option value="injecte">Injecté</option>
                        <option value="nanti">Nanti</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Fiscalité</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Régime fiscal</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                        value={params.taxRegime}
                        onChange={(e) => handleParamChange('taxRegime', e.target.value)}
                      >
                        <option value="lmnp-reel">LMNP Réel (Amortissement)</option>
                        <option value="micro-bic">LMNP Micro-BIC (Abattement 50%)</option>
                        <option value="reel-foncier">Location Nue Réel</option>
                        <option value="micro-foncier">Location Nue Micro-Foncier</option>
                        <option value="sci-is">SCI à l'IS</option>
                        <option value="denormandie">Loi Denormandie (Ancien avec travaux)</option>
                        <option value="locavantages">Loc'Avantages (Intermédiaire)</option>
                      </select>
                      {taxWarning && (
                        <p className={cn("mt-2 text-xs font-medium", taxWarning.color)}>
                          {taxWarning.text}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Votre TMI (Tranche Marginale)</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                        value={params.tmi}
                        onChange={(e) => handleParamChange('tmi', Number(e.target.value))}
                      >
                        <option value={0}>0 %</option>
                        <option value={11}>11 %</option>
                        <option value={30}>30 %</option>
                        <option value={41}>41 %</option>
                        <option value={45}>45 %</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Chart & Summary */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Score Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm font-medium text-slate-500 mb-1">Patrimoine Net Immo</div>
                <div className="text-2xl font-bold text-slate-900">{formatCurrency(finalYear.reWealth)}</div>
                <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 space-y-1">
                  <div className="flex justify-between mb-1"><span>À {params.simulationDurationYears} ans</span></div>
                  <div className="flex justify-between"><span>Effort période:</span> <span>{formatCurrency(totalOutOfPocket)}</span></div>
                  <div className="flex justify-between font-medium text-slate-700"><span>Effort total:</span> <span>{formatCurrency(totalOutOfPocket + params.apport)}</span></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm font-medium text-slate-500 mb-1">Patrimoine Net Obligation</div>
                <div className="text-2xl font-bold text-slate-900">{formatCurrency(finalYear.stockWealth)}</div>
                <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 space-y-1">
                  <div className="flex justify-between mb-1"><span>À {params.simulationDurationYears} ans</span></div>
                  <div className="flex justify-between"><span>Effort période:</span> <span>{formatCurrency(totalOutOfPocket)}</span></div>
                  <div className="flex justify-between font-medium text-slate-700"><span>Effort total:</span> <span>{formatCurrency(totalOutOfPocket + params.apport)}</span></div>
                </div>
              </div>
              <div className={cn(
                "rounded-2xl p-6 shadow-sm border",
                winner === 'Immobilier' ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"
              )}>
                <div className={cn(
                  "text-sm font-medium mb-1",
                  winner === 'Immobilier' ? "text-blue-700" : "text-emerald-700"
                )}>Gagnant : {winner}</div>
                <div className={cn(
                  "text-2xl font-bold",
                  winner === 'Immobilier' ? "text-blue-900" : "text-emerald-900"
                )}>+{formatCurrency(diff)}</div>
                <div className={cn(
                  "text-xs mt-1",
                  winner === 'Immobilier' ? "text-blue-600/70" : "text-emerald-600/70"
                )}>D'écart de richesse</div>
              </div>
            </div>

            {/* Resale Module */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
                  <Home className="w-5 h-5 text-indigo-600" />
                  Bilan à la Revente (Comparaison In Fine)
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Simulez la revente du bien à une année précise pour calculer l'impôt sur la plus-value et le cash réel récupéré.
                </p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Resale Inputs */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup 
                        label="Année de revente" 
                        unit="ans" 
                        value={resaleYear} 
                        onChange={setResaleYear} 
                        step={1}
                        suggestion={`Max: ${params.simulationDurationYears} ans`}
                      />
                      <InputGroup 
                        label="Évolution du prix / an" 
                        unit="%" 
                        value={params.propertyAppreciation} 
                        onChange={(v) => handleParamChange('propertyAppreciation', v)} 
                        step={0.1}
                        suggestion="Moyenne: 1-2%"
                      />
                    </div>

                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4">Détail du Net Vendeur</h3>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Prix d'achat (frais inclus)</span>
                        <span className="font-medium text-slate-900">{formatCurrency(resaleData.acquisitionPrice)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Prix de vente estimé</span>
                        <span className="font-medium text-slate-900">{formatCurrency(resaleData.salePrice)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                        <span className="text-slate-500">Plus-value brute</span>
                        <span className="font-medium text-emerald-600">+{formatCurrency(resaleData.grossPlusValue)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-rose-600">
                        <div className="flex flex-col">
                          <span>Impôt sur la plus-value</span>
                          {resaleData.actualResaleYear > 5 && params.taxRegime !== 'sci-is' && (
                            <span className="text-[10px] text-rose-500/70">
                              Optimisé: Forfait travaux 15% + Frais 7.5%
                            </span>
                          )}
                        </div>
                        <span>-{formatCurrency(resaleData.totalTax)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-rose-600">
                        <span>Remboursement capital restant</span>
                        <span>-{formatCurrency(resaleData.loanBalance)}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold pt-3 border-t border-slate-200">
                        <span className="text-slate-900">Net Vendeur (Cash récupéré)</span>
                        <span className="text-blue-600">{formatCurrency(resaleData.netSeller)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Resale Verdict */}
                  <div className="flex flex-col justify-center space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <div className="text-xs font-medium text-blue-600 mb-1">Bilan Immo (Année {resaleData.actualResaleYear})</div>
                        <div className="text-xl font-bold text-blue-900">{formatCurrency(resaleData.totalImmo)}</div>
                        <div className="text-xs text-blue-700/70 mt-1">Net vendeur + Trésorerie {params.apportUsage === 'nanti' ? '+ Apport nanti' : ''}</div>
                        <div className="text-[10px] text-blue-700/70 mt-2 pt-2 border-t border-blue-200/50 space-y-1">
                          <div className="flex justify-between"><span>Effort période :</span> <span>{formatCurrency(resaleData.totalOutOfPocketResale)}</span></div>
                          <div className="flex justify-between font-medium text-blue-800"><span>Effort total :</span> <span>{formatCurrency(resaleData.totalOutOfPocketResale + params.apport)}</span></div>
                        </div>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="text-xs font-medium text-emerald-600 mb-1">Bilan Obligation (Année {resaleData.actualResaleYear})</div>
                        <div className="text-xl font-bold text-emerald-900">{formatCurrency(resaleData.totalStock)}</div>
                        <div className="text-xs text-emerald-700/70 mt-1">Capital + Intérêts composés</div>
                        <div className="text-[10px] text-emerald-700/70 mt-2 pt-2 border-t border-emerald-200/50 space-y-1">
                          <div className="flex justify-between"><span>Effort période :</span> <span>{formatCurrency(resaleData.totalOutOfPocketResale)}</span></div>
                          <div className="flex justify-between font-medium text-emerald-800"><span>Effort total :</span> <span>{formatCurrency(resaleData.totalOutOfPocketResale + params.apport)}</span></div>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "rounded-2xl p-6 border text-center",
                      resaleData.winner === 'Immobilier' ? "bg-blue-600 border-blue-700" : "bg-emerald-600 border-emerald-700"
                    )}>
                      <div className="text-white/80 text-sm font-medium mb-1">Verdict à la revente</div>
                      <div className="text-white text-2xl font-bold mb-1">
                        Gagnant : {resaleData.winner}
                      </div>
                      <div className="text-white/90 font-medium">
                        +{formatCurrency(resaleData.diff)} net dans votre poche
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Évolution du Patrimoine Net
                </h2>
                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                  <button 
                    onClick={() => setViewMode('year')}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", viewMode === 'year' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  >
                    Par Année
                  </button>
                  <button 
                    onClick={() => setViewMode('month')}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", viewMode === 'month' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  >
                    Par Mois
                  </button>
                </div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRe" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey={viewMode === 'year' ? 'year' : 'label'} 
                      tickFormatter={(val) => viewMode === 'year' ? `Année ${val}` : val}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                      minTickGap={30}
                    />
                    <YAxis 
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k€`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dx={-10}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Area 
                      type="monotone" 
                      name="Immobilier (Net)"
                      dataKey="reWealth" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorRe)" 
                    />
                    <Area 
                      type="monotone" 
                      name="Obligation (Net)"
                      dataKey="stockWealth" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorStock)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-4 bg-slate-50 rounded-xl flex gap-3 text-sm text-slate-600">
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
                <p>
                  <strong>Comparaison à effort d'épargne identique :</strong> Si l'immobilier génère un cash-flow négatif (effort d'épargne), 
                  cette même somme est ajoutée chaque mois au placement obligataire. Si l'immobilier génère un cash-flow positif, il est réinvesti.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Middle Section: Audit Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-slate-600" />
              Audit Détaillé
            </h2>
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button 
                onClick={() => setTableViewMode('year')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", tableViewMode === 'year' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Par Année
              </button>
              <button 
                onClick={() => setTableViewMode('month')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", tableViewMode === 'month' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Par Mois
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 font-medium">{tableViewMode === 'year' ? 'Année' : 'Mois'}</th>
                  <th className="px-6 py-4 font-medium">Valeur Bien</th>
                  <th className="px-6 py-4 font-medium">Capital Restant</th>
                  <th className="px-6 py-4 font-medium">Cash-Flow Immo</th>
                  <th className="px-6 py-4 font-medium">Impôts Payés</th>
                  <th className="px-6 py-4 font-medium">Effort Épargne</th>
                  {isNanti && <th className="px-6 py-4 font-medium text-indigo-600">Capital Nanti</th>}
                  <th className="px-6 py-4 font-medium text-blue-600">Patrimoine Immo</th>
                  <th className="px-6 py-4 font-medium text-emerald-600">Patrimoine Obligation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(tableViewMode === 'year' ? yearlyData : monthlyData).map((row: any) => (
                  <tr key={row.year || row.globalMonth} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{row.year || row.label}</td>
                    <td className="px-6 py-4 text-slate-600">{formatCurrency(row.propertyValue)}</td>
                    <td className="px-6 py-4 text-slate-600">{formatCurrency(row.loanBalance)}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "font-medium",
                        row.cashFlow > 0 ? "text-emerald-600" : row.cashFlow < 0 ? "text-rose-600" : "text-slate-600"
                      )}>
                        {formatCurrency(row.cashFlow)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{formatCurrency(row.taxes)}</td>
                    <td className="px-6 py-4 text-slate-600">{formatCurrency(row.outOfPocket)}</td>
                    {isNanti && <td className="px-6 py-4 font-semibold text-indigo-700">{formatCurrency(row.pledgedWealth)}</td>}
                    <td className="px-6 py-4 font-semibold text-blue-700">{formatCurrency(row.reWealth)}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-700">{formatCurrency(row.stockWealth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section: Advanced Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors rounded-2xl focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-900">Hypothèses Avancées</h2>
            </div>
            {showAdvanced ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          
          {showAdvanced && (
            <div className="p-6 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <InputGroup 
                  label="Rendement Obligation" unit="%" 
                  value={params.stockReturn} onChange={(v) => handleParamChange('stockReturn', v)} step={0.1}
                  suggestion="Fonds Euros/Oblig: 3-5%"
                  subtext={`≈ ${formatCurrency(params.apport * (params.stockReturn / 100))} / an (sur apport)`}
                />
                {isNanti && (
                  <InputGroup 
                    label="Rendement Nantissement" unit="%" 
                    value={params.pledgedReturn} onChange={(v) => handleParamChange('pledgedReturn', v)} step={0.1}
                    suggestion="Assurance Vie: 3-5%"
                    subtext={`≈ ${formatCurrency(params.apport * (params.pledgedReturn / 100))} / an`}
                  />
                )}
                <InputGroup 
                  label="Hausse des loyers / an" unit="%" 
                  value={params.rentAppreciation} onChange={(v) => handleParamChange('rentAppreciation', v)} step={0.1}
                  suggestion="IRL: 1-2%"
                  subtext={`≈ ${formatCurrency(yearlyRent * (params.rentAppreciation / 100))} / an`}
                />
                <InputGroup 
                  label="Frais de notaire" unit="%" 
                  value={params.notaryFeesRate} onChange={(v) => handleParamChange('notaryFeesRate', v)} step={0.1}
                  suggestion="Ancien: 7-8%, Neuf: 2-3%"
                  subtext={`≈ ${formatCurrency(notaryFees)} (unique)`}
                />
                <InputGroup 
                  label="Taxe Foncière" unit="€/an" 
                  value={params.propertyTax} onChange={(v) => handleParamChange('propertyTax', v)}
                  suggestion="~1 mois de loyer"
                />
                <InputGroup 
                  label="Frais de gestion" unit="%" 
                  value={params.managementFeesRate} onChange={(v) => handleParamChange('managementFeesRate', v)} step={0.1}
                  suggestion="Agence: 5-8%"
                  subtext={`≈ ${formatCurrency(yearlyRent * (params.managementFeesRate / 100))} / an`}
                />
                <InputGroup 
                  label="Vacance locative" unit="%" 
                  value={params.vacancyRate} onChange={(v) => handleParamChange('vacancyRate', v)} step={0.1}
                  suggestion="3-4% (1 mois/3 ans)"
                  subtext={`≈ ${formatCurrency(yearlyRent * (params.vacancyRate / 100))} / an`}
                />
                <InputGroup 
                  label="Entretien / an" unit="% du prix" 
                  value={params.maintenanceRate} onChange={(v) => handleParamChange('maintenanceRate', v)} step={0.1}
                  suggestion="0.5-1% du prix"
                  subtext={`≈ ${formatCurrency(params.propertyPrice * (params.maintenanceRate / 100))} / an`}
                />
                <InputGroup 
                  label="Assurance PNO" unit="€/an" 
                  value={params.pnoInsurance} onChange={(v) => handleParamChange('pnoInsurance', v)} step={10}
                  suggestion="Propriétaire Non Occupant"
                />
                <InputGroup 
                  label="Assurance prêt" unit="%" 
                  value={params.insuranceRate} onChange={(v) => handleParamChange('insuranceRate', v)} step={0.01}
                  suggestion="0.1-0.4% selon âge"
                  subtext={`≈ ${formatCurrency(loanAmount * (params.insuranceRate / 100))} / an`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Legal Disclaimer */}
        <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-justify leading-relaxed">
          <strong>Avertissement légal :</strong> Ce simulateur est fourni à titre purement indicatif et pédagogique. Il peut contenir des erreurs, des omissions ou des approximations, notamment en raison de l'évolution constante de la fiscalité. Les résultats obtenus ne constituent en aucun cas un conseil financier, fiscal ou juridique. Tout projet d'investissement doit faire l'objet d'une étude personnalisée et être confirmé par des professionnels habilités (notaire, expert-comptable, conseiller en gestion de patrimoine). L'investissement immobilier et les placements financiers comportent des risques, y compris le risque de perte en capital.
        </div>

      </main>
    </div>
  );
}

// --- Subcomponents ---

function InputGroup({ 
  label, 
  value, 
  unit, 
  onChange,
  step = 1,
  suggestion,
  subtext
}: { 
  label: string; 
  value: number; 
  unit: string; 
  onChange: (val: number) => void;
  step?: number;
  suggestion?: string;
  subtext?: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-end mb-1 gap-2">
        <label className="block text-xs font-medium text-slate-700 whitespace-nowrap">{label}</label>
        {suggestion && <span className="text-[10px] text-slate-400 text-right leading-tight">{suggestion}</span>}
      </div>
      <div className="relative">
        <input
          type="number"
          step={step}
          className="block w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 pr-10 transition-colors"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <span className="text-slate-400 text-sm">{unit}</span>
        </div>
      </div>
      {subtext && (
        <div className="mt-1.5 text-xs text-slate-500 font-medium">
          {subtext}
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isYearly = typeof label === 'number';
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl">
        <p className="font-semibold text-slate-900 mb-2">{isYearly ? `Année ${label}` : label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm mb-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="text-slate-600">{entry.name} :</span>
            <span className="font-semibold text-slate-900">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};
