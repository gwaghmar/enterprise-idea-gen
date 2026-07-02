// Feature flags.
// FREE_MODE hides the $1 paywall — all premium sections and PDF export are
// open. Set NEXT_PUBLIC_FREE_MODE=false to restore the paywall; every
// payment code path stays intact underneath.
export const FREE_MODE = process.env.NEXT_PUBLIC_FREE_MODE !== "false";
