## "Client canceled" message in the preview

**What it is:** The preview restarted at 14:24 UTC, right when you were looking at it. Any page request already in progress got cut off, and the preview frame shows "client canceled" for that stopped request. The site loads normally now (homepage responds fine). No error shows up in the site itself.

**Plan (no code changes):**
1. Refresh the preview. The message should go away.
2. If it keeps coming back after a refresh, I'll load the homepage in a test browser, capture what fails, and report back before changing anything.

**Unrelated note:** The latest automatic check also reports that the local backend checker can't find the Stripe package used by the offers functions. That only affects the local check. Your live checkout and deployed functions are unaffected, and per your deployment rules I won't touch it unless you ask.
