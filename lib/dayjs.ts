/** Dayjs with timezone support (Asia/Shanghai) */
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TIMEZONE = 'Asia/Shanghai';
export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/** Format time to YYYY-MM-DD HH:mm:ss in Asia/Shanghai timezone */
export const formatTime = (date?: dayjs.ConfigType) => dayjs(date).tz(TIMEZONE).format(TIME_FORMAT);

/** Format time to YYYYMMDDHHmmss in Asia/Shanghai timezone (for ID generation) */
export const formatTimeForId = (date?: dayjs.ConfigType) =>
  dayjs(date).tz(TIMEZONE).format('YYYYMMDDHHmmss');

export default dayjs;
