export function getCurrentMicroseconds() {
  if (typeof performance != 'undefined') {
    return Math.floor(performance.now() * 1000);
  } else {
    return Math.floor(eval('require')('perf_hooks').performance.now() * 1000);
  }
}

export function getCurrentTimeWithMilliseconds() {
  const currentDatetime = new Date();
  const hours = currentDatetime.getHours();
  const minutes = currentDatetime.getMinutes();
  const seconds = currentDatetime.getSeconds();
  const milliseconds = currentDatetime.getMilliseconds();
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}
