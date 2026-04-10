export interface SimulatorParams {
  propertyPrice: number;
  works: number;
  notaryFeesRate: number;
  apport: number;
  rent: number;
  loanDurationYears: number;
  simulationDurationYears: number;
  loanRate: number;
  insuranceRate: number;
  loanType: 'amortissable' | 'infine';
  apportUsage?: 'injecte' | 'nanti';
  taxRegime: 'micro-foncier' | 'reel-foncier' | 'micro-bic' | 'lmnp-reel' | 'sci-is' | 'denormandie' | 'locavantages';
  tmi: number;
  stockReturn: number;
  pledgedReturn: number;
  propertyAppreciation: number;
  rentAppreciation: number;
  inflation: number;
  propertyTax: number;
  pnoInsurance: number;
  managementFeesRate: number;
  vacancyRate: number;
  maintenanceRate: number;
  rentStartMonth: number;
}

export interface YearlyData {
  year: number;
  propertyValue: number;
  loanBalance: number;
  reWealth: number;
  stockWealth: number;
  pledgedWealth: number;
  cashFlow: number;
  taxes: number;
  interest: number;
  outOfPocket: number;
}

export interface SimulationResult {
  yearlyData: YearlyData[];
  monthlyData: any[];
}

export function simulate(params: SimulatorParams): SimulationResult {
  const {
    propertyPrice, works, notaryFeesRate, apport, rent, loanDurationYears, simulationDurationYears,
    loanRate, insuranceRate, loanType, apportUsage, taxRegime, tmi, stockReturn, pledgedReturn,
    propertyAppreciation, rentAppreciation, propertyTax, pnoInsurance, managementFeesRate, vacancyRate, maintenanceRate,
    rentStartMonth
  } = params;

  const notaryFees = propertyPrice * (notaryFeesRate / 100);
  const totalProjectCost = propertyPrice + works + notaryFees;
  
  const isNanti = apportUsage === 'nanti';
  const loanAmount = isNanti ? totalProjectCost : Math.max(0, totalProjectCost - apport);

  const monthlyLoanRate = loanRate / 100 / 12;
  const numPayments = loanDurationYears * 12;

  let monthlyMortgage = 0;
  if (loanAmount > 0) {
    if (loanType === 'amortissable') {
      monthlyMortgage = loanAmount * monthlyLoanRate / (1 - Math.pow(1 + monthlyLoanRate, -numPayments));
    } else {
      monthlyMortgage = loanAmount * monthlyLoanRate;
    }
  }
  
  const monthlyInsurance = (loanAmount * (insuranceRate / 100)) / 12;

  const monthlyMaintenance = (propertyPrice * (maintenanceRate / 100)) / 12;
  const monthlyPropertyTax = propertyTax / 12;

  const yearlyData: YearlyData[] = [];
  const monthlyData: any[] = [];

  let currentLoanBalance = loanAmount;
  let currentPropertyValue = propertyPrice + works;
  
  let stockWealth = apport;
  let reInvestedCash = 0;
  let pledgedWealth = isNanti ? apport : 0;
  let cumulativeDeficit = 0; // For reel-foncier and lmnp-reel

  let prevStock = apport;
  let prevPledged = isNanti ? apport : 0;
  let prevReWealth = (propertyPrice + works) - loanAmount + (isNanti ? apport : 0);
  let prevPropertyValue = propertyPrice + works;
  let prevLoanBalance = loanAmount;

  for (let year = 1; year <= simulationDurationYears; year++) {
    let yearlyInterest = 0;
    let yearlyPrincipalPaid = 0;
    let yearlyInsurance = 0;
    let yearlyRent = 0;
    let yearlyManagement = 0;
    
    // Calculate current year's rent based on appreciation
    const currentMonthlyRent = rent * Math.pow(1 + rentAppreciation / 100, year - 1);

    for (let m = 1; m <= 12; m++) {
      const globalMonth = (year - 1) * 12 + m;
      let interest = 0;
      let principal = 0;
      
      if (globalMonth <= loanDurationYears * 12) {
        interest = currentLoanBalance * monthlyLoanRate;
        if (loanType === 'amortissable') {
          principal = monthlyMortgage - interest;
          // Ensure we don't overpay at the very last month
          if (globalMonth === loanDurationYears * 12) {
            principal = currentLoanBalance;
          }
        } else if (loanType === 'infine' && globalMonth === loanDurationYears * 12) {
          principal = currentLoanBalance;
        }
        yearlyInsurance += monthlyInsurance;
      } else {
        currentLoanBalance = 0;
      }

      yearlyInterest += interest;
      yearlyPrincipalPaid += principal;
      currentLoanBalance -= principal;

      if (globalMonth >= rentStartMonth) {
        const mRent = currentMonthlyRent * (1 - vacancyRate / 100);
        yearlyRent += mRent;
        yearlyManagement += mRent * (managementFeesRate / 100);
      }
    }

    const yearlyExpenses = yearlyManagement + (monthlyMaintenance * 12) + propertyTax + pnoInsurance;

    // Tax calculation
    let taxableIncome = 0;
    let taxes = 0;
    const socialRate = 17.2 / 100;
    const tmiRate = tmi / 100;

    if (taxRegime === 'micro-foncier') {
      taxableIncome = yearlyRent * 0.7;
      taxes = taxableIncome * (tmiRate + socialRate);
    } else if (taxRegime === 'reel-foncier' || taxRegime === 'denormandie' || taxRegime === 'locavantages') {
      let currentResult = yearlyRent - yearlyExpenses - yearlyInterest - yearlyInsurance;
      if (currentResult < 0) {
        cumulativeDeficit += Math.abs(currentResult);
        taxes = 0;
      } else {
        if (cumulativeDeficit > 0) {
          if (currentResult >= cumulativeDeficit) {
            taxableIncome = currentResult - cumulativeDeficit;
            cumulativeDeficit = 0;
          } else {
            cumulativeDeficit -= currentResult;
            taxableIncome = 0;
          }
        } else {
          taxableIncome = currentResult;
        }
        taxes = taxableIncome * (tmiRate + socialRate);
      }

      if (taxRegime === 'denormandie') {
        const eligibleBase = Math.min(300000, totalProjectCost);
        let reduction = 0;
        if (year <= 9) {
          reduction = eligibleBase * 0.02;
        } else if (year <= 12) {
          reduction = eligibleBase * 0.01;
        }
        taxes -= reduction;
      } else if (taxRegime === 'locavantages') {
        const reduction = yearlyRent * 0.15;
        taxes -= reduction;
      }
    } else if (taxRegime === 'micro-bic') {
      taxableIncome = yearlyRent * 0.5;
      taxes = taxableIncome * (tmiRate + socialRate);
    } else if (taxRegime === 'lmnp-reel') {
      const amort = (propertyPrice * 0.8) / 30;
      let currentResult = yearlyRent - yearlyExpenses - yearlyInterest - yearlyInsurance - amort;
      if (currentResult < 0) {
        cumulativeDeficit += Math.abs(currentResult);
        taxes = 0;
      } else {
        if (cumulativeDeficit > 0) {
          if (currentResult >= cumulativeDeficit) {
            taxableIncome = currentResult - cumulativeDeficit;
            cumulativeDeficit = 0;
          } else {
            cumulativeDeficit -= currentResult;
            taxableIncome = 0;
          }
        } else {
          taxableIncome = currentResult;
        }
        taxes = taxableIncome * (tmiRate + socialRate);
      }
    } else if (taxRegime === 'sci-is') {
      const amort = (propertyPrice * 0.8) / 30;
      let currentResult = yearlyRent - yearlyExpenses - yearlyInterest - yearlyInsurance - amort;
      if (currentResult < 0) {
        cumulativeDeficit += Math.abs(currentResult);
        taxes = 0;
      } else {
        if (cumulativeDeficit > 0) {
          if (currentResult >= cumulativeDeficit) {
            taxableIncome = currentResult - cumulativeDeficit;
            cumulativeDeficit = 0;
          } else {
            cumulativeDeficit -= currentResult;
            taxableIncome = 0;
          }
        } else {
          taxableIncome = currentResult;
        }
        if (taxableIncome > 0) {
          taxes = taxableIncome <= 42500 ? taxableIncome * 0.15 : (42500 * 0.15 + (taxableIncome - 42500) * 0.25);
        }
      }
    }

    const yearlyCashFlow = yearlyRent - (yearlyPrincipalPaid + yearlyInterest + yearlyInsurance) - yearlyExpenses - taxes;

    const outOfPocket = Math.max(0, -yearlyCashFlow);
    const positiveCash = Math.max(0, yearlyCashFlow);

    stockWealth = stockWealth * (1 + stockReturn / 100) + outOfPocket;
    reInvestedCash = reInvestedCash * (1 + stockReturn / 100) + positiveCash;
    pledgedWealth = pledgedWealth * (1 + pledgedReturn / 100);

    currentPropertyValue = currentPropertyValue * (1 + propertyAppreciation / 100);
    
    let reWealth = currentPropertyValue - currentLoanBalance + reInvestedCash + pledgedWealth;

    yearlyData.push({
      year,
      propertyValue: Math.round(currentPropertyValue),
      loanBalance: Math.round(currentLoanBalance),
      reWealth: Math.round(reWealth),
      stockWealth: Math.round(stockWealth),
      pledgedWealth: Math.round(pledgedWealth),
      cashFlow: Math.round(yearlyCashFlow),
      taxes: Math.round(taxes),
      interest: Math.round(yearlyInterest),
      outOfPocket: Math.round(outOfPocket)
    });

    // Generate accurate monthly data for this year
    const monthlyTaxes = taxes / 12;
    let tempLoanBalance = prevLoanBalance;

    for (let m = 1; m <= 12; m++) {
      const globalMonth = (year - 1) * 12 + m;
      const fraction = m / 12;
      
      let mRent = 0;
      let mMgmt = 0;
      if (globalMonth >= rentStartMonth) {
        mRent = currentMonthlyRent * (1 - vacancyRate / 100);
        mMgmt = mRent * (managementFeesRate / 100);
      }
      
      let mInterest = 0;
      let mPrincipal = 0;
      let mInsurance = 0;

      if (globalMonth <= loanDurationYears * 12) {
        mInterest = tempLoanBalance * monthlyLoanRate;
        if (loanType === 'amortissable') {
          mPrincipal = monthlyMortgage - mInterest;
          if (globalMonth === loanDurationYears * 12) {
            mPrincipal = tempLoanBalance;
          }
        } else if (loanType === 'infine' && globalMonth === loanDurationYears * 12) {
          mPrincipal = tempLoanBalance;
        }
        mInsurance = monthlyInsurance;
      } else {
        tempLoanBalance = 0;
      }
      
      tempLoanBalance -= mPrincipal;

      const mExpenses = mMgmt + monthlyMaintenance + (propertyTax / 12) + (pnoInsurance / 12);
      const mCashFlow = mRent - (mPrincipal + mInterest + mInsurance) - mExpenses - monthlyTaxes;
      const mOutOfPocket = Math.max(0, -mCashFlow);

      monthlyData.push({
        globalMonth,
        label: `A${year} M${m}`,
        propertyValue: Math.round(prevPropertyValue + (currentPropertyValue - prevPropertyValue) * fraction),
        loanBalance: Math.round(tempLoanBalance),
        cashFlow: Math.round(mCashFlow),
        taxes: Math.round(monthlyTaxes),
        outOfPocket: Math.round(mOutOfPocket),
        reWealth: Math.round(prevReWealth + (reWealth - prevReWealth) * fraction),
        stockWealth: Math.round(prevStock + (stockWealth - prevStock) * fraction),
        pledgedWealth: Math.round(prevPledged + (pledgedWealth - prevPledged) * fraction),
      });
    }

    prevStock = stockWealth;
    prevPledged = pledgedWealth;
    prevReWealth = reWealth;
    prevPropertyValue = currentPropertyValue;
    prevLoanBalance = currentLoanBalance;
  }

  return { yearlyData, monthlyData };
}
