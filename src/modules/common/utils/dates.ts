import { format, formatDistanceToNow, parseISO } from 'date-fns';

export const formatDay = (isoDate: string) =>
  format(parseISO(isoDate), 'EEE d MMM');

export const formatRange = (start: string, end: string) =>
  start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;

export const timeAgo = (timestamp: number) =>
  formatDistanceToNow(timestamp, { addSuffix: true });

export const todayInputValue = () => format(new Date(), 'yyyy-MM-dd');
