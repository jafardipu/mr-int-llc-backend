/* eslint-disable @typescript-eslint/no-explicit-any */
const callbackFn = (fn: any, data: any) => {
  if (typeof fn === 'function') {
    fn(data);
  }
  return;
};
export default callbackFn;
