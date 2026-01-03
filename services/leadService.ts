
export interface LeadData {
  name: string;
  email: string;
  phone?: string;
  businessCategory?: string;
  walletId: string;
  coins: number;
}

export interface WalletInfo {
  coins: number;
  name: string;
}

// Updated with the latest URL provided by the user
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxdUXNar5B9XOthE_7bi0loxnwc5g17p9Hkbzx99DeJUQQNrS1wpVMA0zDJ_0dbMeFM/exec';

export const submitLeadToGoogleSheet = async (data: LeadData): Promise<boolean> => {
  try {
    const params = new URLSearchParams();
    params.append('action', 'submitLead');
    params.append('timestamp', new Date().toLocaleString());
    params.append('name', data.name);
    params.append('email', data.email);
    params.append('phone', data.phone || '');
    params.append('businessCategory', data.businessCategory || '');
    params.append('walletId', data.walletId);
    params.append('coins', data.coins.toString());

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    return true;
  } catch (error) {
    console.error('Lead submission failed:', error);
    return false;
  }
};

export const updateWalletBalance = async (walletId: string, newBalance: number): Promise<boolean> => {
  try {
    const params = new URLSearchParams();
    params.append('action', 'updateBalance');
    params.append('walletId', walletId);
    params.append('coins', newBalance.toString());

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    return true;
  } catch (error) {
    console.error('Failed to update balance:', error);
    return false;
  }
};

export const fetchWalletBalance = async (walletId: string): Promise<WalletInfo | null> => {
  try {
    const cleanId = walletId.trim().toUpperCase();
    // Cache busting with Date.now() to ensure fresh data
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getBalance&walletId=${cleanId}&t=${Date.now()}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data && data.success) {
      return {
        coins: typeof data.coins === 'number' ? data.coins : 0,
        // Map the 'name' field from Column B of the Google Sheet
        name: data.name && data.name.toString().trim() !== "" ? data.name : 'Studio Member'
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch wallet info:', error);
    return null;
  }
};
