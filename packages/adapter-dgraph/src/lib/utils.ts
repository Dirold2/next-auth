// https://github.com/honeinc/is-iso-date/blob/master/index.js
const isoDateRE =
  /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/

  function isDate(value: any): boolean {
    return typeof value === 'string' && isoDateRE.test(value) && !isNaN(Date.parse(value));
   }

export const format = {
  from<T>(object?: Record<string, any>): T | null {
    const newObject: Record<string, unknown> = {}
    if (!object) return null
    for (const key in object) {
       const value = object[key]
       if (isDate(value)) {
         // Ensure value is a string before passing it to new Date
         newObject[key] = new Date(value as string)
       } else {
         newObject[key] = value
       }
    }
   
    return newObject as T
   },
}
