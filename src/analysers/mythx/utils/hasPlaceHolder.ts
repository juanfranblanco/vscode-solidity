export function hasPlaceHolder(el: string): string {
    if (el.includes('__$')) {
        el = el.replace(/__\$(.+)\$__/, (m, p) => Array(p.length).fill(0).join('') );
    }
    return el;
}
