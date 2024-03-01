// Source: https://stackoverflow.com/a/34749873/5364135

/** Simple object check */
function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item)
}

/** Deep merge two objects */
export function merge(target: any, ...sources: Array<Record<string, any>>): any {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        merge(target[key] as Record<string, any>, source[key] as Record<string, any>)
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return merge(target, ...sources)
}
