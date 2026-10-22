/*
 * iCryptos shared data helpers.
 *
 * Two data channels feed the dashboards:
 *   - Blogger JSONP feeds  -> "older" projects (mapped by each theme's processEntries)
 *   - assets/data.xlsx     -> "new" curated projects (parsed here with SheetJS)
 *
 * This module turns the Excel sheet into normalized project objects and merges
 * them into the Blogger list: matching projects are enriched with the richer
 * Excel fields, unmatched Excel rows are appended (optionally).
 */
(function (global) {
    'use strict';

    // Column headers used by assets/data.xlsx (trimmed, case-sensitive fallbacks).
    var COLUMNS = {
        icon: ['Icon'],
        name: ['Name', 'Project', 'Title'],
        author: ['Author'],
        tags: ['Tags', 'Tag'],
        link: ['Link', 'URL', 'Url'],
        earningWays: ['EarningWays', 'Earning Ways'],
        currencies: ['SupCurrencies', 'SupportedCurrencies', 'Currencies'],
        minWithdrawal: ['MinWithdrawal', 'Min Withdrawal'],
        payoutsVia: ['PayoutsVia', 'Payouts Via', 'Payouts'],
        platform: ['Platform'],
        referralProg: ['ReferralProg', 'Referral Program', 'Referral'],
        desc: ['Desc', 'Description'],
        paymentProof: ['PaymentProof', 'Payment Proof'],
        sisterFaucets: ['Sister Faucets', 'SisterFaucets', 'Sisters']
    };

    // Normalize text coming from the sheet: strip control/zero-width chars and
    // replace long dashes (em/en/horizontal bar/minus) with a plain hyphen, per
    // the project convention of not using long dashes on the site.
    function cleanText(value) {
        return String(value)
            .replace(/[\u0000\uFEFF\u200B-\u200D]/g, '')
            .replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-')
            .trim();
    }

    function cell(row, keys) {
        for (var i = 0; i < keys.length; i++) {
            var v = row[keys[i]];
            if (v !== undefined && v !== null) {
                var s = cleanText(v);
                if (s !== '') return s;
            }
        }
        return '';
    }

    function splitList(value) {
        if (!value) return [];
        return String(value)
            .split(/[,|\n\r;]+/)
            .map(function (part) { return cleanText(part); })
            .filter(function (part) { return part !== ''; });
    }

    // Split on line breaks only. Used for columns that hold URLs, where a
    // comma or a pipe could be part of the address itself.
    function splitLines(value) {
        if (!value) return [];
        return String(value)
            .split(/\n\r?/)
            .map(function (part) { return cleanText(part); })
            .filter(function (part) { return part !== ''; });
    }

    // ReferralProgram is free text in the sheet: "Yes," / "No" / a full
    // sentence. Reduce it to a tri-state so the UI can label it.
    function referralState(value) {
        var text = cleanText(value || '');
        if (!text) return 'unknown';
        if (/^no\b/i.test(text)) return 'no';
        if (/^yes\b/i.test(text)) return 'yes';
        if (/\bno\b/i.test(text) && !/\bcommission\b|\breferr|\bearn\b|\byou\b/i.test(text)) return 'no';
        return 'yes';
    }

    // PaymentProof holds either a URL or the placeholder "SOON".
    function proofState(value) {
        var text = cleanText(value || '');
        if (!text) return 'unknown';
        if (/^https?:\/\//i.test(text)) return 'link';
        if (/^soon$/i.test(text)) return 'pending';
        return 'pending';
    }

    function normalizeName(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    function hostOf(url) {
        if (!url) return '';
        try {
            return new URL(url, 'https://example.invalid').hostname
                .replace(/^www\./i, '')
                .toLowerCase();
        } catch (err) {
            return '';
        }
    }

    function prettifyHost(host) {
        if (!host) return '';
        var base = host.split('.').slice(0, -1).join('.') || host;
        return base
            .split(/[-_.]/)
            .filter(Boolean)
            .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
            .join(' ');
    }

    // Map a single sheet row -> normalized project object.
    function mapRow(row, options) {
        options = options || {};
        var nameRaw = cell(row, COLUMNS.name);
        var link = cell(row, COLUMNS.link);
        var host = hostOf(link);
        var name = nameRaw || prettifyHost(host) || 'Untitled project';

        var tags = splitList(cell(row, COLUMNS.tags));
        var earningWays = splitList(cell(row, COLUMNS.earningWays));
        var currencies = splitList(cell(row, COLUMNS.currencies));
        var payoutsVia = splitList(cell(row, COLUMNS.payoutsVia));
        var platform = cell(row, COLUMNS.platform);

        // Canonicalize known wallet names so they match the theme wallet filter.
        var walletMap = {};
        (options.wallets || []).forEach(function (w) { walletMap[w.toLowerCase()] = w; });
        payoutsVia = payoutsVia.map(function (t) { return walletMap[t.toLowerCase()] || t; });

        // Tags power search + the theme tag/wallet filters.
        var filterTags = [];
        [tags, earningWays, payoutsVia, currencies].forEach(function (list) {
            list.forEach(function (t) {
                if (t && filterTags.indexOf(t) === -1) filterTags.push(t);
            });
        });
        if (platform && filterTags.indexOf(platform) === -1) filterTags.push(platform);

        var paymentProof = cell(row, COLUMNS.paymentProof);
        var referralProg = cell(row, COLUMNS.referralProg);
        var sisterFaucets = splitLines(cell(row, COLUMNS.sisterFaucets));
        var unverified = !nameRaw;

        return {
            id: 'excel:' + (host || normalizeName(name)),
            name: name,
            url: link,
            host: host,
            tags: filterTags.slice(),
            displayTags: tags.slice(),
            // Verified curated rows rise to the top of the "Newest" sort;
            // link-only/unverified rows fall to the bottom.
            publishedDate: unverified ? new Date(0) : new Date(),
            source: 'excel',
            rich: true,
            unverified: unverified,
            icon: cell(row, COLUMNS.icon),
            author: cell(row, COLUMNS.author),
            earningWays: earningWays,
            currencies: currencies,
            minWithdrawal: cell(row, COLUMNS.minWithdrawal),
            payoutsVia: payoutsVia,
            platform: platform,
            referralProg: referralProg,
            referralState: referralState(referralProg),
            desc: cell(row, COLUMNS.desc),
            paymentProof: paymentProof,
            paymentProofState: proofState(paymentProof),
            sisterFaucets: sisterFaucets,
            iconClass: 'fas fa-star',
            sourceName: 'Curated'
        };
    }

    function rowsToProjects(rows, options) {
        var seen = {};
        var out = [];
        (rows || []).forEach(function (row) {
            var project = mapRow(row, options);
            if (!project.url && !project.host) return; // skip completely empty rows
            if (seen[project.id]) return;
            seen[project.id] = true;
            out.push(project);
        });
        return out;
    }

    // Read + parse assets/data.xlsx in the browser. `url` is required.
    function loadExcel(url, options) {
        options = options || {};
        if (typeof global.XLSX === 'undefined') {
            return Promise.reject(new Error('SheetJS (XLSX) is not loaded'));
        }
        var bust = url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now();
        return fetch(bust, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to fetch ' + url + ' (' + res.status + ')');
                return res.arrayBuffer();
            })
            .then(function (buffer) {
                var workbook = global.XLSX.read(buffer, { type: 'array' });
                var sheetName = options.sheet || workbook.SheetNames[0];
                var sheet = workbook.Sheets[sheetName];
                if (!sheet) return [];
                var rows = global.XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
                return rowsToProjects(rows, options);
            });
    }

    /*
     * Merge Excel projects into the Blogger project list.
     *   - matches by normalized name (primary) and hostname (fallback)
     *   - Excel fields enrich the matched Blogger entry (Excel wins)
     *   - unmatched Excel rows are appended when options.appendNew is true
     */
    function mergeProjects(bloggerProjects, excelProjects, options) {
        options = options || {};
        var merged = (bloggerProjects || []).map(function (p) {
            var copy = Object.assign({}, p);
            copy.tags = (p.tags || []).slice();
            copy.displayTags = (p.displayTags || p.tags || []).slice();
            copy.source = p.source || 'blogger';
            return copy;
        });

        var byName = {};
        var byHost = {};
        merged.forEach(function (p) {
            var nk = normalizeName(p.name);
            if (nk && !byName[nk]) byName[nk] = p;
            var hk = hostOf(p.url);
            if (hk && !byHost[hk]) byHost[hk] = p;
        });

        (excelProjects || []).forEach(function (ex) {
            var nk = normalizeName(ex.name);
            var target = (nk && byName[nk]) || (ex.host && byHost[ex.host]) || null;

            if (target) {
                Object.assign(target, {
                    rich: true,
                    icon: ex.icon || target.icon,
                    author: ex.author || target.author,
                    desc: ex.desc || target.desc,
                    platform: ex.platform || target.platform,
                    paymentProof: ex.paymentProof || target.paymentProof,
                    earningWays: ex.earningWays,
                    currencies: ex.currencies,
                    minWithdrawal: ex.minWithdrawal,
                    payoutsVia: ex.payoutsVia,
                    referralProg: ex.referralProg,
                    referralState: ex.referralState,
                    paymentProofState: ex.paymentProofState,
                    sisterFaucets: ex.sisterFaucets,
                    unverified: ex.unverified,
                    excelUrl: ex.url,
                    blogUrl: target.url
                });
                if (ex.displayTags && ex.displayTags.length) target.displayTags = ex.displayTags.slice();
                // Prefer the real project link from the curated sheet.
                if (ex.url) target.url = ex.url;
                ex.tags.forEach(function (t) {
                    if (target.tags.indexOf(t) === -1) target.tags.push(t);
                });
            } else if (options.appendNew) {
                merged.push(ex);
                if (nk) byName[nk] = ex;
                if (ex.host) byHost[ex.host] = ex;
            }
        });

        return merged;
    }

    global.ICryptosData = {
        loadExcel: loadExcel,
        mapRow: mapRow,
        rowsToProjects: rowsToProjects,
        mergeProjects: mergeProjects,
        splitList: splitList,
        splitLines: splitLines,
        referralState: referralState,
        proofState: proofState,
        normalizeName: normalizeName,
        hostOf: hostOf,
        prettifyHost: prettifyHost
    };
})(window);
