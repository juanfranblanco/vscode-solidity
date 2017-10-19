'use strict';

export function formatPath(contractPath: string) {
    return contractPath.replace(/\\/g, '/');
}


export function throttle(fn, threshhold): Function {
    threshhold || (threshhold = 250);
    var last, deferTimer;

    return function () {
        var context = this;
  
        var now = +new Date,
            args = arguments;
        if (last && now < last + threshhold) {
            // hold on to it
            clearTimeout(deferTimer);
            deferTimer = setTimeout(function () {
                last = now;
                fn.apply(context, args);
            }, threshhold + last - now);
        } else {
            last = now;
            fn.apply(context, args);
        }
    };
}
