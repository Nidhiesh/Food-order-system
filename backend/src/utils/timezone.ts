/**
 * Timezone utilities for Asia/Kolkata timezone operations.
 */

export function getKolkataTime(): Date {
  const utcDate = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(utcDate);
  
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  const year = parseInt(getPart('year'));
  const month = parseInt(getPart('month')) - 1; // 0-indexed
  const day = parseInt(getPart('day'));
  const hour = parseInt(getPart('hour'));
  const minute = parseInt(getPart('minute'));
  const second = parseInt(getPart('second'));
  
  return new Date(year, month, day, hour, minute, second);
}

export function getKolkataBusinessDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export interface ShopStatus {
  isOpen: boolean;
  code: 'BEFORE_HOURS' | 'AFTER_HOURS' | 'MANUALLY_CLOSED' | 'OPEN';
  message: string;
}

export function determineShopStatus(manualClosed: boolean, openingTime = "08:00", closingTime = "11:00"): ShopStatus {
  if (manualClosed) {
    return {
      isOpen: false,
      code: 'MANUALLY_CLOSED',
      message: 'The shop is currently not accepting orders.'
    };
  }

  const time = getKolkataTime();
  const hour = time.getHours();
  const minute = time.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const [startHour, startMin] = openingTime.split(':').map(Number);
  const [endHour, endMin] = closingTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (currentMinutes < startMinutes) {
    return {
      isOpen: false,
      code: 'BEFORE_HOURS',
      message: `Shop Closed. Ordering opens at ${openingTime} AM.`
    };
  }

  if (currentMinutes >= endMinutes) {
    return {
      isOpen: false,
      code: 'AFTER_HOURS',
      message: "Shop Closed. Today's ordering has ended."
    };
  }

  return {
    isOpen: true,
    code: 'OPEN',
    message: 'Shop Open'
  };
}
