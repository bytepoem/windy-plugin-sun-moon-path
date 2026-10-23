export interface UsageEnvironment {
    $browser: string;
    $os: string;
    $device_type: 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';
}

/** Classify coarse client families locally; never upload the raw user agent or device model. */
export const classifyUsageEnvironment = (userAgent: string, maxTouchPoints = 0): UsageEnvironment => {
    const ipad = /iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
    const android = /Android/i.test(userAgent);
    const ios = ipad || /iPhone|iPod/i.test(userAgent);
    const browser = /Edg(?:A|iOS)?\//i.test(userAgent) ? 'Microsoft Edge'
        : /OPR\/|OPiOS\//i.test(userAgent) ? 'Opera'
        : /SamsungBrowser\//i.test(userAgent) ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//i.test(userAgent) ? 'Firefox'
        : /Chrome\/|CriOS\//i.test(userAgent) ? 'Chrome'
        : /Safari\//i.test(userAgent) ? 'Safari' : 'Unknown';
    const os = ios ? 'iOS' : android ? 'Android'
        : /CrOS/i.test(userAgent) ? 'Chrome OS'
        : /Windows/i.test(userAgent) ? 'Windows'
        : /Macintosh|Mac OS X/i.test(userAgent) ? 'macOS'
        : /Linux/i.test(userAgent) ? 'Linux' : 'Unknown';
    const tablet = ipad || /Tablet/i.test(userAgent) || (android && !/Mobile/i.test(userAgent));
    const mobile = /Mobi|iPhone|iPod/i.test(userAgent);
    return {
        $browser: browser,
        $os: os,
        $device_type: tablet ? 'Tablet' : mobile ? 'Mobile' : os !== 'Unknown' ? 'Desktop' : 'Unknown',
    };
};

/** Called only after analytics consent is checked by the usage transport. */
export const readUsageEnvironment = (): UsageEnvironment => classifyUsageEnvironment(
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
    typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
);
