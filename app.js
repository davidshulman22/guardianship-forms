// ============================================
// GS Court Forms — App Logic
// Data model: Clients → Matters → Forms
// Storage: localStorage (no backend required)
// ============================================

let formsConfig = null;
let clients = [];          // Array of client objects
let currentClient = null;  // Selected client
let currentMatter = null;  // Selected matter
let currentFormId = null;
let selectedFormIds = [];   // Multi-select: array of selected form IDs
let currentFormData = {};
let editingClientId = null;
let editingMatterId = null;

// ============================================
// FORM BUNDLES — common filing sets
// ============================================

const formBundles = {
    probate: [
        {
            name: 'Open Estate (testate)',
            formIds: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900', 'BW-0010', 'BW-0020']
        },
        {
            name: 'Open Estate (intestate)',
            formIds: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900', 'BW-0010']
        },
        {
            name: 'Notice to Creditors',
            formIds: ['P3-0740']
        },
        {
            name: 'Inventory',
            formIds: ['P3-0900']
        },
        {
            name: 'Closing (Discharge)',
            formIds: ['P5-0400', 'P5-0800']
        },
        {
            name: 'Summary Admin (testate)',
            formIds: ['P2-PETITION', 'P2-ORDER', 'P2-0355']
        },
        {
            name: 'Summary Admin (intestate)',
            formIds: ['P2-PETITION', 'P2-ORDER', 'P2-0355']
        }
    ],
    guardianship: [
        {
            name: 'Incapacity Petition',
            formIds: ['G2-010']
        },
        {
            name: 'Emergency Temp Guardian',
            formIds: ['G3-010']
        }
    ]
};

// Form sections — categorize probate forms into lifecycle phases
// Opening forms are handled by the wizard; these define Administration and Closing
const formSections = {
    probate: {
        formal: {
            // Opening form IDs are determined by the wizard matrix — not listed here
            administration: {
                label: 'Estate Administration',
                subtitle: 'Mid-estate filings',
                formIds: ['P3-0740', 'P3-0900']
            },
            closing: {
                label: 'Close Estate',
                subtitle: 'Discharge and closing',
                formIds: ['P5-0400', 'P5-0800']
            }
        },
        summary: {
            administration: {
                label: 'Estate Administration',
                subtitle: 'Post-order filings',
                formIds: ['P2-0355']
            }
            // Will admission for summary admin is built into P2-ORDER (combined
            // order admitting will + summary admin) — no separate "additional
            // orders" section needed.
        }
    }
};

// ============================================
// INITIALIZATION
// ============================================

async function initializeApp() {
    console.info('[init] waiting for auth');
    await window.ensureAuthenticated();
    console.info('[init] auth ready, loading forms config');
    await loadFormsConfig();
    console.info('[init] loading clients from Supabase');
    try {
        await loadClientsFromSupabase();
    } catch (err) {
        console.error('[init] loadClientsFromSupabase threw:', err);
        showNotification('Failed to load data from server — working from local cache', 'error');
    }
    console.info('[init] rendering UI');
    renderClientList();
    setupEventListeners();
    setupClaudeImport();
    showView('noClient');
    console.info('[init] done');
}

async function loadFormsConfig() {
    try {
        const response = await fetch('forms.json');
        if (!response.ok) throw new Error('Failed to load forms config');
        formsConfig = await response.json();
    } catch (error) {
        console.error('Error loading forms config:', error);
        showNotification('Failed to load form configuration', 'error');
    }
}

// ============================================
// PERSISTENCE (Supabase) — localStorage is a fast-paint cache only
// ============================================

const CLIENTS_CACHE_KEY = 'gs_court_forms_clients_cache';

// Map between the in-memory shape (camelCase, nested) and the DB shape.
function dbClientToMem(row) {
    return {
        id: row.id,
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        address: row.address || '',
        phone: row.phone || '',
        email: row.email || '',
        createdAt: row.created_at,
        createdBy: row.created_by,
        matters: []
    };
}

function dbMatterToMem(row) {
    return {
        id: row.id,
        clientId: row.client_id,
        type: row.type,
        subjectName: row.subject_name || '',
        county: row.county || '',
        fileNo: row.file_no || '',
        division: row.division || '',
        matterData: row.matter_data || {},
        formData: {},           // filled in from form_data rows
        createdAt: row.created_at,
        createdBy: row.created_by
    };
}

function memClientToDb(c) {
    return {
        id: c.id,
        first_name: c.firstName || null,
        last_name: c.lastName || null,
        address: c.address || null,
        phone: c.phone || null,
        email: c.email || null,
        created_by: window.currentUser.id
    };
}

function memMatterToDb(m, clientId) {
    return {
        id: m.id,
        client_id: clientId,
        type: m.type,
        subject_name: m.subjectName || null,
        county: m.county || null,
        file_no: m.fileNo || null,
        division: m.division || null,
        matter_data: m.matterData || {},
        created_by: window.currentUser.id
    };
}

function isUuid(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Ensure every client/matter has a UUID. Legacy cached records used
// timestamp-based IDs; those won't upsert cleanly to Supabase.
function ensureUuids() {
    let changed = false;
    clients.forEach(c => {
        if (!isUuid(c.id)) { c.id = crypto.randomUUID(); changed = true; }
        (c.matters || []).forEach(m => {
            if (!isUuid(m.id)) { m.id = crypto.randomUUID(); changed = true; }
        });
    });
    return changed;
}

window.userProfilesById = {};

async function loadClientsFromSupabase() {
    // Paint cached data immediately for snappy first render.
    const cached = localStorage.getItem(CLIENTS_CACHE_KEY);
    if (cached) {
        try { clients = JSON.parse(cached); } catch (_) { clients = []; }
    } else {
        clients = [];
    }

    // Then fetch authoritative state from Supabase. RLS filters this
    // to the current user's own rows (or everything if admin).
    const sb = window.supabaseClient;

    const [clientsRes, mattersRes, formDataRes, profilesRes] = await Promise.all([
        sb.from('clients').select('*').order('created_at', { ascending: true }),
        sb.from('matters').select('*').order('created_at', { ascending: true }),
        sb.from('form_data').select('*'),
        sb.from('user_profiles').select('id, email')
    ]);

    window.userProfilesById = {};
    (profilesRes.data || []).forEach(p => {
        window.userProfilesById[p.id] = p.email || '';
    });

    if (clientsRes.error) {
        console.error('Failed to load clients:', clientsRes.error);
        showNotification('Failed to load clients from server', 'error');
        return;
    }

    const clientsById = new Map();
    (clientsRes.data || []).forEach(row => {
        clientsById.set(row.id, dbClientToMem(row));
    });

    (mattersRes.data || []).forEach(row => {
        const client = clientsById.get(row.client_id);
        if (client) client.matters.push(dbMatterToMem(row));
    });

    const mattersById = new Map();
    clientsById.forEach(c => c.matters.forEach(m => mattersById.set(m.id, m)));

    (formDataRes.data || []).forEach(row => {
        const matter = mattersById.get(row.matter_id);
        if (matter) matter.formData[row.form_id] = row.data || {};
    });

    clients = Array.from(clientsById.values());
    cacheClientsLocally();
}

function cacheClientsLocally() {
    try {
        localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(clients));
    } catch (_) { /* quota or disabled — ignore */ }
}

function seedTestData() {
    clients = [
        {
            id: 'test-maggie',
            firstName: 'Margaret',
            lastName: 'Torres',
            address: '4521 NE 12th Ave\nFort Lauderdale, FL 33334',
            phone: '954-555-0142',
            email: 'maggie.torres@email.com',
            createdAt: new Date().toISOString(),
            matters: [
                {
                    id: 'matter-guard-robert',
                    type: 'guardianship',
                    subjectName: 'Robert James Torres',
                    county: 'Broward',
                    fileNo: '',
                    division: '',
                    formData: {},
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'matter-guard-sophia',
                    type: 'guardianship',
                    subjectName: 'Sophia Grace Reyes',
                    county: 'Broward',
                    fileNo: '',
                    division: '',
                    formData: {},
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'matter-probate-helen',
                    type: 'probate',
                    subjectName: 'Helen Marie Torres',
                    county: 'Broward',
                    fileNo: '',
                    division: '',
                    matterData: {
                        is_testate: true,
                        is_ancillary: false,
                        decedent_full_name: 'Helen Marie Torres',
                        decedent_address: '1200 SW 3rd St, Apt 204, Fort Lauderdale, FL 33312',
                        decedent_death_date: 'March 2, 2026',
                        decedent_death_place: 'Fort Lauderdale, Broward County, Florida',
                        decedent_domicile: 'Broward',
                        decedent_ssn_last4: '4829'
                    },
                    formData: {
                        'P3-PETITION': {
                            petitioners: [
                                {
                                    pet_name: 'Margaret Torres',
                                    pet_address: '4521 NE 12th Ave, Fort Lauderdale, FL 33334',
                                    pet_interest: 'surviving daughter and sole beneficiary under the will'
                                }
                            ],
                            prs: [
                                {
                                    pr_name: 'Margaret Torres',
                                    pr_address: '4521 NE 12th Ave, Fort Lauderdale, FL 33334',
                                    pr_is_fl_resident: true,
                                    pr_relationship: ''
                                }
                            ],
                            petitioner_has_prior_conviction: false,
                            higher_preference_exists: false,
                            higher_preference_formal_notice: false,
                            estate_tax_return_required: false,
                            domiciliary_proceedings_pending: false,
                            will_date: 'June 15',
                            will_year: '2019',
                            codicil_dates: '',
                            will_status_original: true,
                            will_status_authenticated_other: false,
                            will_status_authenticated_notarial: false,
                            venue_reason: 'the decedent was domiciled in Broward County, Florida at the time of death',
                            estate_assets_description: 'residential real property in Broward County, a 2018 Toyota Camry, two bank accounts, and tangible personal property, with an aggregate approximate value of $485,000',
                            beneficiaries: [
                                {
                                    ben_name: 'Margaret Torres',
                                    ben_address: '4521 NE 12th Ave, Fort Lauderdale, FL 33334',
                                    ben_relationship: 'Daughter',
                                    ben_year_of_birth: ''
                                },
                                {
                                    ben_name: 'Robert James Torres',
                                    ben_address: '1200 SW 3rd St, Apt 204, Fort Lauderdale, FL 33312',
                                    ben_relationship: 'Surviving spouse',
                                    ben_year_of_birth: ''
                                },
                                {
                                    ben_name: 'Carlos Reyes',
                                    ben_address: '890 Flamingo Dr, Pembroke Pines, FL 33028',
                                    ben_relationship: 'Son-in-law (guardian of Sophia Reyes, granddaughter)',
                                    ben_year_of_birth: ''
                                }
                            ]
                        }
                    },
                    createdAt: new Date().toISOString()
                }
            ]
        },
        {
            id: 'test-villareal',
            firstName: 'Juanita',
            lastName: 'Munoz-Space',
            address: '14 Canfield Way\nAvon, CT 06001',
            phone: '',
            email: '',
            createdAt: new Date().toISOString(),
            matters: [
                {
                    id: 'matter-guard-villareal',
                    type: 'guardianship',
                    subjectName: 'Nancy Aya Villareal',
                    county: 'Broward',
                    fileNo: '',
                    division: 'Probate',
                    matterData: {
                        aip_age: '69',
                        aip_residence: 'Seaside-Hallandale Beach Senior Living, 2091 South Ocean Drive, Hallandale Beach, FL 33009',
                        aip_address: 'Seaside-Hallandale Beach Senior Living, 2091 South Ocean Drive, Hallandale Beach, FL 33009'
                    },
                    formData: {
                        'G3-025': {
                            petitioner_residence: 'Avon, CT',
                            petitioner_address: '14 Canfield Way Avon, CT 06001',
                            ward_incapacity_nature: 'Delusional disorders and psychosis',
                            has_alternatives: false,
                            has_preneed: false,
                            preneed_reason: 'as the AIP has no preneed documents',
                            proposed_guardian_name: 'Juanita Munoz-Space',
                            proposed_guardian_residence: '14 Canfield Way Avon, CT 06001',
                            proposed_guardian_address: '14 Canfield Way Avon, CT 06001',
                            is_professional_guardian: false,
                            proposed_guardian_relationship: 'Daughter',
                            appointment_reason: 'the proposed Guardian is the daughter of the AIP and the one who is best able to handle the Guardianship and take care of her mother. As her Father and the Husband of the AIP is in an assisted living facility and the other child of the AIP is resident in Spain, the Petitioner is the best person to serve as Guardian',
                            signing_month: 'April',
                            signing_year: '2026',
                            next_of_kin: [
                                {
                                    name: 'Jaime Eduardo Munoz Mantilla',
                                    address: 'The Peninsula Assisted Living, 5100 West Hallandale Beach Blvd., Hollywood, FL 33023',
                                    relationship: 'Husband'
                                },
                                {
                                    name: 'Estefania Munoz',
                                    address: 'Madrid, Spain',
                                    relationship: 'Child'
                                },
                                {
                                    name: 'Juanita Munoz-Space',
                                    address: '14 Canfield Way Avon, CT 06001',
                                    relationship: 'Child and proposed Guardian'
                                }
                            ],
                            property_items: [
                                {
                                    item_description: 'Homestead Property located at 1945 South Ocean Blvd. #308 Hallandale Florida',
                                    item_value: '$500,000'
                                },
                                {
                                    item_description: 'Bank Account - Merrill Lynch - JOINT',
                                    item_value: '$240,000'
                                },
                                {
                                    item_description: 'Bank Account - Checking Bank of America - JOINT',
                                    item_value: '$500'
                                },
                                {
                                    item_description: 'Bank Account - Savings Bank of America - JOINT',
                                    item_value: '$200'
                                }
                            ]
                        }
                    },
                    createdAt: new Date().toISOString()
                }
            ]
        }
    ];
    saveClientsToStorage();
}

// Public save function. Callers mutate the `clients` array then invoke this.
// We cache locally for fast paint and schedule a debounced push to Supabase.
function saveClientsToStorage() {
    ensureUuids();
    cacheClientsLocally();
    scheduleSupabaseSync();
}

let _syncTimer = null;
let _syncInFlight = null;
function scheduleSupabaseSync() {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
        // Serialize syncs so we never overlap two writers.
        if (_syncInFlight) { await _syncInFlight; }
        _syncInFlight = pushClientsToSupabase().catch(err => {
            console.error('Supabase sync failed:', err);
            showNotification('Save to server failed — working from local cache', 'error');
        }).finally(() => { _syncInFlight = null; });
    }, 500);
}

async function pushClientsToSupabase() {
    if (!window.currentUser) return;
    const sb = window.supabaseClient;

    // Upsert clients
    const clientRows = clients.map(memClientToDb);
    if (clientRows.length > 0) {
        const { error } = await sb.from('clients').upsert(clientRows, { onConflict: 'id' });
        if (error) throw error;
    }

    // Upsert matters
    const matterRows = [];
    clients.forEach(c => {
        (c.matters || []).forEach(m => {
            matterRows.push(memMatterToDb(m, c.id));
        });
    });
    if (matterRows.length > 0) {
        const { error } = await sb.from('matters').upsert(matterRows, { onConflict: 'id' });
        if (error) throw error;
    }

    // Upsert form_data (one row per matter × form_id)
    const formDataRows = [];
    clients.forEach(c => {
        (c.matters || []).forEach(m => {
            const fd = m.formData || {};
            Object.keys(fd).forEach(formId => {
                formDataRows.push({
                    matter_id: m.id,
                    form_id: formId,
                    data: fd[formId] || {},
                    created_by: window.currentUser.id
                });
            });
        });
    });
    if (formDataRows.length > 0) {
        const { error } = await sb.from('form_data').upsert(formDataRows, { onConflict: 'matter_id,form_id' });
        if (error) throw error;
    }
}

function generateId() {
    // UUIDs so records can be upserted to Supabase cleanly.
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Fallback for older browsers (extremely unlikely in 2026)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================
// VIEW MANAGEMENT
// ============================================

function showView(view) {
    document.getElementById('viewNoClient').style.display = 'none';
    document.getElementById('viewClient').style.display = 'none';
    document.getElementById('viewMatter').style.display = 'none';

    if (view === 'noClient') {
        document.getElementById('viewNoClient').style.display = 'block';
        document.getElementById('breadcrumb').textContent = '';
        renderHomepage();
    } else if (view === 'client') {
        document.getElementById('viewClient').style.display = 'block';
        document.getElementById('breadcrumb').textContent = currentClient ? currentClient.firstName + ' ' + currentClient.lastName : '';
    } else if (view === 'matter') {
        document.getElementById('viewMatter').style.display = 'block';
        const clientName = currentClient ? currentClient.firstName + ' ' + currentClient.lastName : '';
        const matterName = currentMatter ? currentMatter.subjectName || currentMatter.type : '';
        document.getElementById('breadcrumb').textContent = clientName + ' > ' + matterName;
    }
}

function navigateHome() {
    currentClient = null;
    currentMatter = null;
    currentFormId = null;
    selectedFormIds = [];
    currentFormData = {};
    renderClientList();
    showView('noClient');
}

function renderHomepage() {
    // --- Recent Matters ---
    const recentContainer = document.getElementById('homeRecentMatters');
    const allMatters = [];
    clients.forEach(client => {
        (client.matters || []).forEach(matter => {
            allMatters.push({ client, matter });
        });
    });
    // Sort by createdAt descending
    allMatters.sort((a, b) => (b.matter.createdAt || '').localeCompare(a.matter.createdAt || ''));
    const recent = allMatters.slice(0, 5);

    if (recent.length === 0) {
        recentContainer.innerHTML = '<p class="empty-state">No matters yet. Create a client and add a matter to get started.</p>';
    } else {
        recentContainer.innerHTML = '';
        recent.forEach(({ client, matter }) => {
            const div = document.createElement('div');
            div.className = 'home-matter-item';

            const lastInitial = (matter.subjectName || '?').split(' ').pop().charAt(0).toUpperCase();
            const iconClass = matter.type || 'probate';
            const title = matter.type === 'probate'
                ? 'Estate of ' + (matter.subjectName || 'Unknown')
                : 'Guardianship — ' + (matter.subjectName || 'Unknown');
            const clientName = (client.firstName || '') + ' ' + (client.lastName || '');
            const subtitle = [clientName.trim(), matter.county ? matter.county + ' County' : ''].filter(Boolean).join(' · ');

            div.innerHTML =
                '<div class="home-matter-icon ' + iconClass + '">' + lastInitial + '</div>' +
                '<div class="home-matter-body">' +
                    '<div class="home-matter-title">' + title + '</div>' +
                    '<div class="home-matter-subtitle">' + subtitle + '</div>' +
                '</div>';

            div.addEventListener('click', () => {
                currentClient = client;
                renderClientList();
                selectMatter(matter);
            });
            recentContainer.appendChild(div);
        });
    }

    // --- Stats ---
    const statsContainer = document.getElementById('homeStats');
    const totalClients = clients.length;
    const totalMatters = allMatters.length;
    const probateCount = allMatters.filter(m => m.matter.type === 'probate').length;
    const guardianshipCount = allMatters.filter(m => m.matter.type === 'guardianship').length;

    statsContainer.innerHTML =
        '<div class="home-stat-card"><div class="home-stat-number">' + totalClients + '</div><div class="home-stat-label">Clients</div></div>' +
        '<div class="home-stat-card"><div class="home-stat-number">' + probateCount + '</div><div class="home-stat-label">Probate Matters</div></div>' +
        '<div class="home-stat-card"><div class="home-stat-number">' + guardianshipCount + '</div><div class="home-stat-label">Guardianship Matters</div></div>';
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupCollapsibleSections() {
    const SECTIONS = ['openEstateWizard', 'adminSection', 'closingSection'];
    const STORAGE_KEY = 'gs_court_forms_collapsed_sections';

    // Restore saved collapsed state so the layout doesn't jump on load.
    let collapsed = [];
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) collapsed = JSON.parse(saved) || [];
    } catch (_) { collapsed = []; }

    SECTIONS.forEach(id => {
        const panel = document.getElementById(id);
        if (!panel) return;
        if (collapsed.includes(id)) panel.classList.add('is-collapsed');

        const header = panel.querySelector('.section-header, .wizard-header');
        if (!header) return;
        header.addEventListener('click', (e) => {
            // Don't collapse when clicking something interactive inside the header.
            if (e.target.closest('button, a, input, select')) return;
            panel.classList.toggle('is-collapsed');

            const nowCollapsed = SECTIONS.filter(s => {
                const el = document.getElementById(s);
                return el && el.classList.contains('is-collapsed');
            });
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nowCollapsed)); } catch (_) { }
        });
    });
}

function setupEventListeners() {
    // App title — click to go home
    document.getElementById('appTitleLink').addEventListener('click', navigateHome);

    // Homepage quick action buttons
    document.getElementById('homeNewClientBtn').addEventListener('click', () => openClientModal());
    document.getElementById('homeImportBtn').addEventListener('click', openClaudeImportModal);

    // Client search
    document.getElementById('clientSearch').addEventListener('input', debounce(filterClients, 300));

    // New client
    document.getElementById('newClientBtn').addEventListener('click', () => openClientModal());
    document.getElementById('editClientBtn').addEventListener('click', () => openClientModal(currentClient));
    document.getElementById('clientForm').addEventListener('submit', handleClientFormSubmit);

    // New matter
    document.getElementById('newMatterBtn').addEventListener('click', () => openMatterModal());
    document.getElementById('editMatterBtn').addEventListener('click', () => openMatterModal(currentMatter));
    document.getElementById('matterForm').addEventListener('submit', handleMatterFormSubmit);
    document.getElementById('matterType').addEventListener('change', updateMatterSubjectHint);

    // Back button
    document.getElementById('backToClientBtn').addEventListener('click', () => {
        currentMatter = null;
        currentFormId = null;
        selectedFormIds = [];
        currentFormData = {};
        showView('client');
        renderMatterList();
    });

    // Generate
    document.getElementById('generateDocBtn').addEventListener('click', generateDocuments);

    // Open Estate Wizard (probate)
    setupWizard();
    // Open Guardianship Wizard
    setupGuardianshipWizard();

    // Collapsible lifecycle sections (Open Estate / Estate Admin / Close Estate)
    setupCollapsibleSections();

    // Modal close buttons (all of them)
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Modal backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAllModals();
        });
    });

    // Form field auto-save to memory
    document.addEventListener('input', (e) => {
        if (e.target.closest('#formFieldsContainer')) {
            collectFormData();
        }
    });
    document.addEventListener('change', (e) => {
        if (e.target.closest('#formFieldsContainer')) {
            collectFormData();
        }
    });

    // Repeating group add/remove
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-row-btn')) {
            addRepeatingGroupRow(e.target.dataset.field);
        }
        if (e.target.classList.contains('remove-btn')) {
            removeRepeatingGroupRow(e.target.dataset.field, parseInt(e.target.dataset.index, 10));
        }
    });
}

// ============================================
// CLIENT LIST
// ============================================

function ownerLabel(userId) {
    // Only admins see the owner tag — regular users only see their own rows anyway.
    if (!window.isAdmin || !window.isAdmin()) return '';
    if (!userId) return '';
    const email = (window.userProfilesById && window.userProfilesById[userId]) || '';
    if (!email) return '';
    // Short label: "david" / "jill" from the email local-part
    const short = email.split('@')[0];
    return '<span class="owner-tag">' + short + '</span>';
}

function renderClientList() {
    const list = document.getElementById('clientList');
    list.innerHTML = '';

    if (clients.length === 0) {
        list.innerHTML = '<p class="empty-state">No clients yet</p>';
        return;
    }

    clients.forEach(client => {
        const div = document.createElement('div');
        div.className = 'client-item' + (currentClient && currentClient.id === client.id ? ' active' : '');
        const owner = ownerLabel(client.createdBy);
        div.innerHTML = `
            <div class="client-item-name">${client.lastName || ''}, ${client.firstName || ''} ${owner}</div>
            <div class="client-item-info">${(client.matters || []).length} matter(s)</div>
        `;
        div.addEventListener('click', () => selectClient(client));
        list.appendChild(div);
    });
}

function selectClient(client) {
    currentClient = client;
    currentMatter = null;
    currentFormId = null;
    selectedFormIds = [];
    currentFormData = {};

    renderClientList();
    renderClientView();
    showView('client');
}

function renderClientView() {
    if (!currentClient) return;

    document.getElementById('clientHeaderName').textContent =
        (currentClient.firstName || '') + ' ' + (currentClient.lastName || '');

    const info = document.getElementById('clientContactInfo');
    const parts = [];
    // client.address may now be an object (structured) or string (legacy /
    // imported). formatAddressValue normalizes either to a single-line string
    // suitable for inline display.
    if (currentClient.address) {
        const addrStr = formatAddressValue(currentClient.address);
        if (addrStr) parts.push(addrStr.replace(/\n/g, '<br>'));
    }
    if (currentClient.phone) parts.push('Phone: ' + currentClient.phone);
    if (currentClient.email) parts.push('Email: ' + currentClient.email);
    info.innerHTML = parts.join('<br>') || '<span class="empty-state">No contact info</span>';

    renderMatterList();
}

function filterClients() {
    const query = document.getElementById('clientSearch').value.toLowerCase();
    const items = document.querySelectorAll('.client-item');
    items.forEach(item => {
        const name = item.querySelector('.client-item-name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? '' : 'none';
    });
}

// ============================================
// CLIENT MODAL
// ============================================

function openClientModal(client) {
    editingClientId = client ? client.id : null;
    document.getElementById('clientModalTitle').textContent = client ? 'Edit Client' : 'New Client';
    document.getElementById('clientFirstName').value = client ? client.firstName || '' : '';
    document.getElementById('clientLastName').value = client ? client.lastName || '' : '';
    document.getElementById('clientPhone').value = client ? client.phone || '' : '';
    document.getElementById('clientEmail').value = client ? client.email || '' : '';

    // Render the structured address picker. Accepts either an object (new
    // shape) or a string (legacy / freshly-typed) — renderAddressField
    // parses strings on the fly via parseStringToStructuredAddress so the
    // structured grid populates automatically.
    const addressContainer = document.getElementById('clientAddressContainer');
    addressContainer.innerHTML = '';
    addressContainer.appendChild(renderAddressField({
        value: client ? client.address : null,
        label: '',
        dataBase: { context: 'client' }
    }));

    document.getElementById('newClientModal').style.display = 'flex';
}

// Walk the .address-sub-input elements in a container and assemble the
// structured address object (no docxtemplater coupling — used by the
// client modal where there's no formData scope).
function readAddressFromContainer(containerEl) {
    const out = {};
    containerEl.querySelectorAll('.address-sub-input').forEach(input => {
        const key = input.dataset.addressKey;
        if (!key) return;
        out[key] = (input.type === 'checkbox') ? input.checked : input.value;
    });
    return out;
}

function handleClientFormSubmit(e) {
    e.preventDefault();
    const addressContainer = document.getElementById('clientAddressContainer');
    const data = {
        firstName: document.getElementById('clientFirstName').value,
        lastName: document.getElementById('clientLastName').value,
        address: readAddressFromContainer(addressContainer),
        phone: document.getElementById('clientPhone').value,
        email: document.getElementById('clientEmail').value,
    };

    if (editingClientId) {
        // Update existing
        const idx = clients.findIndex(c => c.id === editingClientId);
        if (idx >= 0) {
            clients[idx] = { ...clients[idx], ...data };
            if (currentClient && currentClient.id === editingClientId) {
                currentClient = clients[idx];
            }
        }
    } else {
        // Create new
        const newClient = {
            id: generateId(),
            ...data,
            matters: [],
            createdAt: new Date().toISOString(),
            createdBy: window.currentUser ? window.currentUser.id : null
        };
        clients.unshift(newClient);
        currentClient = newClient;
    }

    saveClientsToStorage();
    renderClientList();
    renderClientView();
    showView('client');
    closeAllModals();
    showNotification(editingClientId ? 'Client updated' : 'Client created', 'success');
}

// ============================================
// MATTER LIST
// ============================================

function renderMatterList() {
    if (!currentClient) return;
    const list = document.getElementById('matterList');
    const matters = currentClient.matters || [];

    if (matters.length === 0) {
        list.innerHTML = '<p class="empty-state">No matters yet. Click "+ New Matter" to add one.</p>';
        return;
    }

    // Sort by subject last name
    const sorted = [...matters].sort((a, b) => {
        const lastA = (a.subjectName || '').split(' ').pop().toLowerCase();
        const lastB = (b.subjectName || '').split(' ').pop().toLowerCase();
        return lastA.localeCompare(lastB);
    });

    list.innerHTML = '';
    sorted.forEach(matter => {
        const div = document.createElement('div');
        div.className = 'matter-item';

        const lastInitial = (matter.subjectName || '?').split(' ').pop().charAt(0).toUpperCase();
        const icon = lastInitial;
        const iconClass = matter.type || 'probate';
        const title = matter.type === 'probate'
            ? 'Probate — Estate of ' + (matter.subjectName || 'Unknown')
            : 'Guardianship — ' + (matter.subjectName || 'Unknown');
        const subtitle = [matter.county ? matter.county + ' County' : '', matter.fileNo ? 'File No. ' + matter.fileNo : ''].filter(Boolean).join(' | ');

        div.innerHTML = `
            <div class="matter-item-icon ${iconClass}">${icon}</div>
            <div class="matter-item-body">
                <div class="matter-item-title">${title}</div>
                <div class="matter-item-subtitle">${subtitle || 'No case details yet'}</div>
            </div>
        `;
        div.addEventListener('click', () => selectMatter(matter));
        list.appendChild(div);
    });
}

function selectMatter(matter) {
    currentMatter = matter;
    currentFormId = null;
    selectedFormIds = [];
    currentFormData = {};
    renderMatterView();
    showView('matter');
}

function renderMatterView() {
    if (!currentMatter) return;

    const title = currentMatter.type === 'probate'
        ? 'Probate — Estate of ' + (currentMatter.subjectName || 'Unknown')
        : 'Guardianship — ' + (currentMatter.subjectName || 'Unknown');
    document.getElementById('matterHeaderName').textContent = title;

    // Matter info
    const info = document.getElementById('matterInfo');
    info.innerHTML = '';
    const fields = [
        { label: 'Type', value: currentMatter.type ? currentMatter.type.charAt(0).toUpperCase() + currentMatter.type.slice(1) : '' },
        { label: 'Subject', value: currentMatter.subjectName },
        { label: 'County', value: currentMatter.county },
        { label: 'File No.', value: currentMatter.fileNo },
        { label: 'Division', value: currentMatter.division },
    ];
    fields.forEach(f => {
        if (f.value) {
            const div = document.createElement('div');
            div.className = 'matter-info-item';
            div.innerHTML = `<span class="matter-info-label">${f.label}</span><span class="matter-info-value">${f.value}</span>`;
            info.appendChild(div);
        }
    });

    // Initialize wizard for this matter
    initWizardForMatter();

    // Populate form multi-select filtered by matter type
    populateFormSelector();

    // Reset form fields
    document.getElementById('formFieldsSection').style.display = 'none';
    document.getElementById('formFieldsContainer').innerHTML = '';
}

// ============================================
// MATTER MODAL
// ============================================

function openMatterModal(matter) {
    editingMatterId = matter ? matter.id : null;
    document.getElementById('matterModalTitle').textContent = matter ? 'Edit Matter' : 'New Matter';
    document.getElementById('matterType').value = matter ? matter.type || '' : '';
    document.getElementById('matterCounty').value = matter ? matter.county || '' : '';
    document.getElementById('matterSubjectName').value = matter ? matter.subjectName || '' : '';
    document.getElementById('matterAttorneyId').value = matter ? matter.attorneyId || '' : '';
    updateMatterSubjectHint();
    document.getElementById('newMatterModal').style.display = 'flex';
}

function updateMatterSubjectHint() {
    const type = document.getElementById('matterType').value;
    const hint = document.getElementById('matterSubjectHint');
    if (type === 'probate') {
        hint.textContent = '(decedent name)';
    } else if (type === 'guardianship') {
        hint.textContent = '(AIP or ward name)';
    } else {
        hint.textContent = '(decedent or AIP)';
    }
}

function handleMatterFormSubmit(e) {
    e.preventDefault();
    if (!currentClient) return;

    // File No. and Division are not collected at intake — they're assigned
    // by the clerk after filing. Existing matters keep whatever they have;
    // new matters start blank and templates render `{file_no}` / `{division}`
    // as empty strings.
    // Strip leading "Estate of " (any case, with or without trailing space)
    // so users who type "Estate of Helen Torres" don't end up with display
    // strings like "Probate — Estate of Estate of Helen Torres". The display
    // layer prepends "Estate of " automatically for probate matters.
    const rawSubject = document.getElementById('matterSubjectName').value.trim();
    const subjectName = rawSubject.replace(/^estate\s+of\s+/i, '');

    const data = {
        type: document.getElementById('matterType').value,
        county: document.getElementById('matterCounty').value,
        subjectName,
        attorneyId: document.getElementById('matterAttorneyId').value || null,
    };

    if (!currentClient.matters) currentClient.matters = [];

    if (editingMatterId) {
        const idx = currentClient.matters.findIndex(m => m.id === editingMatterId);
        if (idx >= 0) {
            currentClient.matters[idx] = { ...currentClient.matters[idx], ...data };
            if (currentMatter && currentMatter.id === editingMatterId) {
                currentMatter = currentClient.matters[idx];
            }
        }
    } else {
        const newMatter = {
            id: generateId(),
            ...data,
            formData: {},
            createdAt: new Date().toISOString(),
            createdBy: window.currentUser ? window.currentUser.id : null
        };
        currentClient.matters.push(newMatter);
    }

    saveClientsToStorage();
    renderClientList();
    renderMatterList();
    if (currentMatter) renderMatterView();
    closeAllModals();
    showNotification(editingMatterId ? 'Matter updated' : 'Matter created', 'success');
}

// ============================================
// OPEN ESTATE WIZARD
// ============================================

const wizardFormMatrix = {
    // Formal Administration — same smart templates cover every variant.
    // The templates branch internally on is_testate / is_ancillary /
    // multiple_petitioners / multiple_prs (set from matter.matterData /
    // petitioners array length).
    'formal|testate|domiciliary|single': {
        forms: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900'],
        broward: ['BW-0010', 'BW-0020']
    },
    'formal|testate|domiciliary|multiple': {
        forms: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900'],
        broward: ['BW-0010', 'BW-0020']
    },
    'formal|intestate|domiciliary|single': {
        forms: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900'],
        broward: ['BW-0010', 'BW-0030', 'BW-0060']
    },
    'formal|intestate|domiciliary|multiple': {
        forms: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900'],
        broward: ['BW-0010', 'BW-0030', 'BW-0060']
    },
    'formal|testate|ancillary|single': {
        forms: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900'],
        broward: ['BW-0010']
    },
    'formal|testate|ancillary|multiple': {
        forms: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900'],
        broward: ['BW-0010']
    },
    'formal|intestate|ancillary|single': {
        forms: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900'],
        broward: ['BW-0010']
    },
    'formal|intestate|ancillary|multiple': {
        forms: ['P3-PETITION', 'P3-ORDER', 'P3-OATH', 'P3-LETTERS', 'P1-0900'],
        broward: ['BW-0010']
    },

    // Summary Administration — all 8 variants collapse to one bundle.
    // P2-PETITION/P2-ORDER branch internally on is_testate / is_ancillary /
    // multiple_petitioners (set on matter.matterData by the wizard).
    'summary|testate|domiciliary|single': {
        forms: ['P2-PETITION', 'P2-ORDER', 'P2-0355'],
        broward: ['BW-0010', 'BW-0040']
    },
    'summary|testate|domiciliary|multiple': {
        forms: ['P2-PETITION', 'P2-ORDER', 'P2-0355'],
        broward: ['BW-0010', 'BW-0040']
    },
    'summary|intestate|domiciliary|single': {
        forms: ['P2-PETITION', 'P2-ORDER', 'P2-0355'],
        broward: ['BW-0010', 'BW-0050', 'BW-0060']
    },
    'summary|intestate|domiciliary|multiple': {
        forms: ['P2-PETITION', 'P2-ORDER', 'P2-0355'],
        broward: ['BW-0010', 'BW-0050', 'BW-0060']
    },
    'summary|testate|ancillary|single': {
        forms: ['P2-PETITION', 'P2-ORDER', 'P2-0355'],
        broward: ['BW-0010']
    },
    'summary|testate|ancillary|multiple': {
        forms: ['P2-PETITION', 'P2-ORDER', 'P2-0355'],
        broward: ['BW-0010']
    },
    'summary|intestate|ancillary|single': {
        forms: ['P2-PETITION', 'P2-ORDER', 'P2-0355'],
        broward: ['BW-0010']
    },
    'summary|intestate|ancillary|multiple': {
        forms: ['P2-PETITION', 'P2-ORDER', 'P2-0355'],
        broward: ['BW-0010']
    }
};

let wizardState = {
    adminType: null,    // 'formal' | 'summary'
    willType: null,     // 'testate' | 'intestate'
    jurisdiction: null, // 'domiciliary' | 'ancillary'
    petitioners: null,  // 'single' | 'multiple'
    county: null
};

function setupWizard() {
    // Toggle button groups
    ['wizAdminType', 'wizWillType', 'wizJurisdiction', 'wizPetitioners'].forEach(groupId => {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.wiz-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Toggle: if already active, deselect
                const wasActive = btn.classList.contains('active');
                group.querySelectorAll('.wiz-btn').forEach(b => b.classList.remove('active'));
                if (!wasActive) btn.classList.add('active');

                // Update state
                const val = wasActive ? null : btn.dataset.value;
                if (groupId === 'wizAdminType') wizardState.adminType = val;
                else if (groupId === 'wizWillType') wizardState.willType = val;
                else if (groupId === 'wizJurisdiction') wizardState.jurisdiction = val;
                else if (groupId === 'wizPetitioners') wizardState.petitioners = val;

                updateWizardUI();
            });
        });
    });

    // County dropdown
    document.getElementById('wizCounty').addEventListener('change', (e) => {
        wizardState.county = e.target.value || null;
        updateWizardUI();
    });

    // Load Forms button
    document.getElementById('wizLoadFormsBtn').addEventListener('click', wizardLoadForms);
}

function updateWizardUI() {
    // Petitioners applies to BOTH formal and summary admin — the smart
    // templates (P3-PETITION / P3-ORDER / P3-LETTERS) branch on
    // multiple_petitioners / multiple_prs at render time.
    const petGroup = document.getElementById('wizPetitionerGroup');
    if (petGroup) petGroup.style.opacity = '1';

    // Enable/disable Load Forms button
    const btn = document.getElementById('wizLoadFormsBtn');
    const ready = wizardState.adminType && wizardState.willType && wizardState.jurisdiction && wizardState.petitioners && wizardState.county;
    btn.disabled = !ready;

    // Preview which forms will be loaded
    if (ready) {
        previewWizardForms();
    } else {
        const listEl = document.getElementById('wizFormList');
        listEl.classList.remove('visible');
    }
}

function previewWizardForms() {
    const key = [wizardState.adminType, wizardState.willType, wizardState.jurisdiction, wizardState.petitioners].join('|');
    const entry = wizardFormMatrix[key];
    const listEl = document.getElementById('wizFormList');

    if (!entry) {
        listEl.innerHTML = '<p class="wizard-note">This combination is not yet available.</p>';
        listEl.classList.add('visible');
        document.getElementById('wizLoadFormsBtn').disabled = true;
        return;
    }

    let allForms = [...entry.forms];
    let localForms = [];
    if (wizardState.county === 'Broward' && entry.broward) {
        localForms = entry.broward;
        allForms = allForms.concat(localForms);
    }

    let html = '<div class="wizard-form-list-title">Forms to generate</div><div class="wizard-form-tags">';
    allForms.forEach(formId => {
        const form = formsConfig ? formsConfig.forms.find(f => f.id === formId) : null;
        const name = form ? form.name : formId;
        const isLocal = localForms.includes(formId);
        const shortName = name.length > 50 ? name.substring(0, 47) + '...' : name;
        html += `<span class="wizard-form-tag${isLocal ? ' local' : ''}" title="${name}">${formId}</span>`;
    });
    html += '</div>';

    if (wizardState.willType === 'testate') {
        html += '<p class="wizard-note">Remember: original will must be deposited with the Clerk. Death certificate must also be filed.</p>';
    } else {
        html += '<p class="wizard-note">Remember: death certificate must be filed. Affidavit of Heirs required for intestate.</p>';
    }

    listEl.innerHTML = html;
    listEl.classList.add('visible');
}

function wizardLoadForms() {
    const key = [wizardState.adminType, wizardState.willType, wizardState.jurisdiction, wizardState.petitioners].join('|');
    const entry = wizardFormMatrix[key];
    if (!entry) return;

    let allForms = [...entry.forms];
    if (wizardState.county === 'Broward' && entry.broward) {
        allForms = allForms.concat(entry.broward);
    }

    // Save wizard selections to the matter so we can restore them later
    if (currentMatter) {
        currentMatter.wizardSelections = {
            adminType: wizardState.adminType,
            willType: wizardState.willType,
            jurisdiction: wizardState.jurisdiction,
            petitioners: wizardState.petitioners,
            county: wizardState.county
        };
        // Also propagate wizard booleans to matterData so smart templates
        // (P3-PETITION/P3-ORDER/P3-LETTERS) get is_testate / is_ancillary,
        // and the questionnaire UI gates (row locking, conditional fields)
        // pick up multiple_petitioners / multiple_prs.
        if (!currentMatter.matterData) currentMatter.matterData = {};
        currentMatter.matterData.is_testate = wizardState.willType === 'testate';
        currentMatter.matterData.is_ancillary = wizardState.jurisdiction === 'ancillary';
        currentMatter.matterData.multiple_petitioners = wizardState.petitioners === 'multiple';
        currentMatter.matterData.multiple_prs = wizardState.petitioners === 'multiple';
        saveClientsToStorage();
    }

    // Update lifecycle section cards to match the new admin type
    populateFormSections();

    // Set the selected forms and trigger rendering
    selectedFormIds = allForms;
    currentFormId = selectedFormIds[0];

    // Also sync the manual form checklist
    syncCheckboxes();
    updateBundleButtons();

    // Merge saved form data
    currentFormData = {};
    selectedFormIds.forEach(formId => {
        if (currentMatter && currentMatter.formData && currentMatter.formData[formId]) {
            const saved = currentMatter.formData[formId];
            Object.keys(saved).forEach(k => {
                const val = saved[k];
                if (val !== '' && val !== null && val !== undefined && val !== false) {
                    currentFormData[k] = val;
                }
            });
        }
    });

    renderMergedFormFields();

    // Scroll to the fields
    setTimeout(() => {
        document.getElementById('formFieldsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    showNotification(allForms.length + ' forms loaded', 'success');
}

// ============================================
// OPEN GUARDIANSHIP WIZARD
// ============================================
// Mirrors the Open Estate wizard pattern. The smart templates
// (G3-PETITION/OATH/ORDER/LETTERS) branch internally on
// is_minor / is_voluntary / is_plenary / is_limited / scope_*
// flags propagated to matter.matterData by wizardLoadGuardianshipForms.

const wizardFormMatrix_guardianship = {
    // Adult-incapacity, no emergency: full opening packet (incl. G2-010 Petition to
    // Determine Incapacity + G2-140 Notice of Designation). Smart G3-PETITION branches
    // on plenary/limited × person/property/both.
    'adult|plenary|person|no':   { forms: ['G2-010', 'G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|plenary|property|no': { forms: ['G2-010', 'G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|plenary|both|no':     { forms: ['G2-010', 'G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|limited|person|no':   { forms: ['G2-010', 'G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|limited|property|no': { forms: ['G2-010', 'G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|limited|both|no':     { forms: ['G2-010', 'G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },

    // Adult-incapacity, with emergency: adds G3-EMERGENCY (today's G3-010, kept separate
    // — different statute §744.3031). Long-term plenary/limited petition still filed.
    'adult|plenary|person|yes':   { forms: ['G2-010', 'G2-140', 'G3-EMERGENCY', 'G3-EMERGENCY-ORDER', 'G3-EMERGENCY-LETTERS', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|plenary|property|yes': { forms: ['G2-010', 'G2-140', 'G3-EMERGENCY', 'G3-EMERGENCY-ORDER', 'G3-EMERGENCY-LETTERS', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|plenary|both|yes':     { forms: ['G2-010', 'G2-140', 'G3-EMERGENCY', 'G3-EMERGENCY-ORDER', 'G3-EMERGENCY-LETTERS', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|limited|person|yes':   { forms: ['G2-010', 'G2-140', 'G3-EMERGENCY', 'G3-EMERGENCY-ORDER', 'G3-EMERGENCY-LETTERS', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|limited|property|yes': { forms: ['G2-010', 'G2-140', 'G3-EMERGENCY', 'G3-EMERGENCY-ORDER', 'G3-EMERGENCY-LETTERS', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'adult|limited|both|yes':     { forms: ['G2-010', 'G2-140', 'G3-EMERGENCY', 'G3-EMERGENCY-ORDER', 'G3-EMERGENCY-LETTERS', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },

    // Minor: NO incapacity proceedings (G2-010 not used). Smart G3-PETITION branches
    // on is_minor + scope. Authority is N/A — minor guardianship is statutorily defined.
    'minor|na|person|na':   { forms: ['G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'minor|na|property|na': { forms: ['G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },
    'minor|na|both|na':     { forms: ['G2-140', 'G3-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS'], broward: ['BW-0010'] },

    // Voluntary: §744.341, property only by definition. Different petition (G3-VOL-PETITION,
    // separate template). Includes G3-120 Physician's Certificate (required by statute).
    'voluntary|na|na|na': { forms: ['G2-140', 'G3-VOL-PETITION', 'G3-OATH', 'G3-ORDER', 'G3-LETTERS', 'G3-120'], broward: ['BW-0010'] }
};

let wizardState_guardianship = {
    capacity: null,    // 'adult' | 'minor' | 'voluntary'
    authority: null,   // 'plenary' | 'limited' | (null for non-adult)
    scope: null,       // 'person' | 'property' | 'both' | (null for voluntary)
    emergency: null,   // 'yes' | 'no' | (null for non-adult)
    county: null
};

function setupGuardianshipWizard() {
    ['gWizCapacity', 'gWizAuthority', 'gWizScope', 'gWizEmergency'].forEach(groupId => {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.wiz-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const wasActive = btn.classList.contains('active');
                group.querySelectorAll('.wiz-btn').forEach(b => b.classList.remove('active'));
                if (!wasActive) btn.classList.add('active');
                const val = wasActive ? null : btn.dataset.value;

                if (groupId === 'gWizCapacity') {
                    wizardState_guardianship.capacity = val;
                    // Reset dependent fields when capacity changes — prior selections may
                    // become invalid (e.g. authority is N/A for minor, scope is N/A for voluntary).
                    wizardState_guardianship.authority = null;
                    wizardState_guardianship.scope = null;
                    wizardState_guardianship.emergency = null;
                    ['gWizAuthority', 'gWizScope', 'gWizEmergency'].forEach(g => {
                        document.querySelectorAll('#' + g + ' .wiz-btn').forEach(b => b.classList.remove('active'));
                    });
                } else if (groupId === 'gWizAuthority') {
                    wizardState_guardianship.authority = val;
                } else if (groupId === 'gWizScope') {
                    wizardState_guardianship.scope = val;
                } else if (groupId === 'gWizEmergency') {
                    wizardState_guardianship.emergency = val;
                }
                updateGuardianshipWizardUI();
            });
        });
    });

    const countySel = document.getElementById('gWizCounty');
    if (countySel) {
        countySel.addEventListener('change', (e) => {
            wizardState_guardianship.county = e.target.value || null;
            updateGuardianshipWizardUI();
        });
    }

    const loadBtn = document.getElementById('gWizLoadFormsBtn');
    if (loadBtn) loadBtn.addEventListener('click', wizardLoadGuardianshipForms);
}

function updateGuardianshipWizardUI() {
    const s = wizardState_guardianship;

    // Authority: shown only for adult (incapacity); minor/voluntary use statutory defaults.
    const authGroup = document.getElementById('gWizAuthorityGroup');
    if (authGroup) authGroup.style.display = (s.capacity === 'adult') ? '' : 'none';

    // Scope: shown for adult + minor. Voluntary is property-only by §744.341.
    const scopeGroup = document.getElementById('gWizScopeGroup');
    if (scopeGroup) scopeGroup.style.display = (s.capacity === 'voluntary') ? 'none' : '';

    // Emergency: only meaningful for adult-incapacity (§744.3031).
    const emerGroup = document.getElementById('gWizEmergencyGroup');
    if (emerGroup) emerGroup.style.display = (s.capacity === 'adult') ? '' : 'none';

    // Determine readiness: required fields depend on capacity.
    let ready = false;
    if (s.capacity === 'adult') {
        ready = s.authority && s.scope && s.emergency && s.county;
    } else if (s.capacity === 'minor') {
        ready = s.scope && s.county;
    } else if (s.capacity === 'voluntary') {
        ready = s.county;
    }

    const btn = document.getElementById('gWizLoadFormsBtn');
    if (btn) btn.disabled = !ready;

    if (ready) {
        previewGuardianshipWizardForms();
    } else {
        const listEl = document.getElementById('gWizFormList');
        if (listEl) listEl.classList.remove('visible');
    }
}

function guardianshipWizardKey(state) {
    const s = state;
    if (s.capacity === 'minor') return 'minor|na|' + s.scope + '|na';
    if (s.capacity === 'voluntary') return 'voluntary|na|na|na';
    if (s.capacity === 'adult') return ['adult', s.authority, s.scope, s.emergency].join('|');
    return null;
}

function previewGuardianshipWizardForms() {
    const key = guardianshipWizardKey(wizardState_guardianship);
    const entry = key && wizardFormMatrix_guardianship[key];
    const listEl = document.getElementById('gWizFormList');
    if (!listEl) return;

    if (!entry) {
        listEl.innerHTML = '<p class="wizard-note">This combination is not yet available.</p>';
        listEl.classList.add('visible');
        const btn = document.getElementById('gWizLoadFormsBtn');
        if (btn) btn.disabled = true;
        return;
    }

    let allForms = [...entry.forms];
    let localForms = [];
    if (wizardState_guardianship.county === 'Broward' && entry.broward) {
        localForms = entry.broward;
        allForms = allForms.concat(localForms);
    }

    let html = '<div class="wizard-form-list-title">Forms to generate</div><div class="wizard-form-tags">';
    allForms.forEach(formId => {
        const form = formsConfig ? formsConfig.forms.find(f => f.id === formId) : null;
        const name = form ? form.name : formId;
        const isLocal = localForms.includes(formId);
        html += `<span class="wizard-form-tag${isLocal ? ' local' : ''}" title="${name}">${formId}</span>`;
    });
    html += '</div>';

    if (wizardState_guardianship.capacity === 'adult') {
        html += '<p class="wizard-note">Examining-committee paperwork (G-2.040, G-2.051) follows the Order Appointing Examining Committee — file these forms first to open the case.</p>';
    } else if (wizardState_guardianship.capacity === 'minor') {
        html += '<p class="wizard-note">Minor guardianship: no incapacity proceedings required. Application for Appointment as Guardian (G-3.055) is filed separately by the proposed guardian.</p>';
    } else if (wizardState_guardianship.capacity === 'voluntary') {
        html += '<p class="wizard-note">Voluntary guardianship under §744.341. Physician\'s Certificate (G-3.120) must accompany the petition.</p>';
    }

    listEl.innerHTML = html;
    listEl.classList.add('visible');
}

function wizardLoadGuardianshipForms() {
    const key = guardianshipWizardKey(wizardState_guardianship);
    const entry = key && wizardFormMatrix_guardianship[key];
    if (!entry) return;

    let allForms = [...entry.forms];
    if (wizardState_guardianship.county === 'Broward' && entry.broward) {
        allForms = allForms.concat(entry.broward);
    }

    if (currentMatter) {
        const s = wizardState_guardianship;
        currentMatter.wizardSelections = {
            capacity: s.capacity,
            authority: s.authority,
            scope: s.scope,
            emergency: s.emergency,
            county: s.county
        };
        // Propagate flags to matter.matterData so smart templates and questionnaire
        // visibility rules (visible_if matter_flag) pick them up.
        if (!currentMatter.matterData) currentMatter.matterData = {};
        currentMatter.matterData.is_minor = s.capacity === 'minor';
        currentMatter.matterData.is_voluntary = s.capacity === 'voluntary';
        currentMatter.matterData.is_adult_incapacity = s.capacity === 'adult';
        currentMatter.matterData.is_plenary = s.authority === 'plenary';
        currentMatter.matterData.is_limited = s.authority === 'limited';
        currentMatter.matterData.scope_person = (s.scope === 'person' || s.scope === 'both');
        currentMatter.matterData.scope_property = (s.scope === 'property' || s.scope === 'both');
        currentMatter.matterData.scope_both = s.scope === 'both';
        // Exclusive scope flags for questionnaire visibility (visible_if takes
        // only one matter_flag — these collapse two-axis gates into one).
        currentMatter.matterData.is_scope_person_only = s.scope === 'person';
        currentMatter.matterData.is_scope_property_only = s.scope === 'property';
        // Limited-guardianship section gates (is_limited + scope axis).
        currentMatter.matterData.show_limited_person_rights =
            s.authority === 'limited' && (s.scope === 'person' || s.scope === 'both');
        currentMatter.matterData.show_limited_property_rights_only =
            s.authority === 'limited' && s.scope === 'property';
        currentMatter.matterData.show_limited_property_section =
            s.authority === 'limited' && (s.scope === 'property' || s.scope === 'both');
        // Property-section gate (any scope that includes property, regardless
        // of plenary/limited/minor).
        currentMatter.matterData.includes_property =
            s.scope === 'property' || s.scope === 'both';
        currentMatter.matterData.is_emergency_temporary = s.emergency === 'yes';
        saveClientsToStorage();
    }

    populateFormSections();

    selectedFormIds = allForms;
    currentFormId = selectedFormIds[0];
    syncCheckboxes();
    updateBundleButtons();

    currentFormData = {};
    selectedFormIds.forEach(formId => {
        if (currentMatter && currentMatter.formData && currentMatter.formData[formId]) {
            const saved = currentMatter.formData[formId];
            Object.keys(saved).forEach(k => {
                const val = saved[k];
                if (val !== '' && val !== null && val !== undefined && val !== false) {
                    currentFormData[k] = val;
                }
            });
        }
    });

    renderMergedFormFields();

    setTimeout(() => {
        document.getElementById('formFieldsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    showNotification(allForms.length + ' forms loaded', 'success');
}

function initGuardianshipWizardForMatter() {
    const saved = currentMatter && currentMatter.wizardSelections;
    // Only restore if the saved selections look like guardianship shape
    // (probate matters carry adminType/willType, which we ignore here).
    const looksLikeGuardianship = saved && (saved.capacity !== undefined);

    wizardState_guardianship = {
        capacity: looksLikeGuardianship ? saved.capacity : null,
        authority: looksLikeGuardianship ? saved.authority : null,
        scope: looksLikeGuardianship ? saved.scope : null,
        emergency: looksLikeGuardianship ? saved.emergency : null,
        county: looksLikeGuardianship ? saved.county : (currentMatter ? currentMatter.county || null : null)
    };

    const stateMap = {
        gWizCapacity: wizardState_guardianship.capacity,
        gWizAuthority: wizardState_guardianship.authority,
        gWizScope: wizardState_guardianship.scope,
        gWizEmergency: wizardState_guardianship.emergency
    };
    Object.keys(stateMap).forEach(groupId => {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.wiz-btn').forEach(b => {
            b.classList.remove('active');
            if (stateMap[groupId] && b.dataset.value === stateMap[groupId]) {
                b.classList.add('active');
            }
        });
    });

    const countySelect = document.getElementById('gWizCounty');
    if (countySelect && currentMatter) {
        const county = wizardState_guardianship.county || currentMatter.county || '';
        const option = Array.from(countySelect.options).find(o => o.value.toLowerCase() === county.toLowerCase());
        if (option) {
            countySelect.value = option.value;
            wizardState_guardianship.county = option.value;
        } else if (county) {
            const newOpt = document.createElement('option');
            newOpt.value = county;
            newOpt.textContent = county;
            countySelect.insertBefore(newOpt, countySelect.lastElementChild);
            countySelect.value = county;
            wizardState_guardianship.county = county;
        }
    }

    // Recompute conditional visibility + button-enable
    updateGuardianshipWizardUI();

    // Hide any stale form preview
    const listEl = document.getElementById('gWizFormList');
    if (listEl) listEl.classList.remove('visible');

    // Update header
    const titleEl = document.getElementById('gWizardTitle');
    const subtitleEl = document.getElementById('gWizardSubtitle');
    if (looksLikeGuardianship && saved.capacity) {
        if (titleEl) titleEl.textContent = 'Open Guardianship';
        if (subtitleEl) subtitleEl.textContent = 'Change selections below if needed';
        // Auto-load forms so user doesn't have to click again
        const ready = (
            (wizardState_guardianship.capacity === 'adult' &&
             wizardState_guardianship.authority &&
             wizardState_guardianship.scope &&
             wizardState_guardianship.emergency &&
             wizardState_guardianship.county) ||
            (wizardState_guardianship.capacity === 'minor' &&
             wizardState_guardianship.scope &&
             wizardState_guardianship.county) ||
            (wizardState_guardianship.capacity === 'voluntary' &&
             wizardState_guardianship.county)
        );
        if (ready) setTimeout(() => wizardLoadGuardianshipForms(), 50);
    } else {
        if (titleEl) titleEl.textContent = 'Open Guardianship';
        if (subtitleEl) subtitleEl.textContent = 'Answer these questions to load the correct forms';
    }
}

function initWizardForMatter() {
    // Check if this matter already has wizard selections saved
    // If not, but it has imported data (_shared formData), infer selections
    if (currentMatter && !currentMatter.wizardSelections && currentMatter.type === 'probate') {
        const fd = currentMatter.formData && currentMatter.formData._shared;
        if (fd && Object.keys(fd).length > 0) {
            const hasWill = !!(fd.will_date || fd.will_year || fd.codicil_dates);
            const petArr = fd.petitioners;
            const hasMultiplePetitioners = Array.isArray(petArr) && petArr.length > 1;
            currentMatter.wizardSelections = {
                adminType: 'formal',
                willType: hasWill ? 'testate' : 'intestate',
                jurisdiction: 'domiciliary',
                petitioners: hasMultiplePetitioners ? 'multiple' : 'single',
                county: currentMatter.county || null
            };
            saveClientsToStorage();
        }
    }
    const saved = currentMatter && currentMatter.wizardSelections;

    // Reset wizard state
    wizardState = {
        adminType: saved ? saved.adminType : null,
        willType: saved ? saved.willType : null,
        jurisdiction: saved ? saved.jurisdiction : null,
        petitioners: saved ? saved.petitioners : null,
        county: saved ? saved.county : (currentMatter ? currentMatter.county || null : null)
    };

    // Reset toggle buttons, then restore saved selections
    const stateMap = {
        wizAdminType: wizardState.adminType,
        wizWillType: wizardState.willType,
        wizJurisdiction: wizardState.jurisdiction,
        wizPetitioners: wizardState.petitioners
    };
    ['wizAdminType', 'wizWillType', 'wizJurisdiction', 'wizPetitioners'].forEach(groupId => {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.wiz-btn').forEach(b => {
            b.classList.remove('active');
            if (stateMap[groupId] && b.dataset.value === stateMap[groupId]) {
                b.classList.add('active');
            }
        });
    });

    // Set county from saved selections or matter
    const countySelect = document.getElementById('wizCounty');
    if (countySelect && currentMatter) {
        const county = wizardState.county || currentMatter.county || '';
        const option = Array.from(countySelect.options).find(o => o.value.toLowerCase() === county.toLowerCase());
        if (option) {
            countySelect.value = option.value;
            wizardState.county = option.value;
        } else if (county) {
            // Add it as a custom option
            const newOpt = document.createElement('option');
            newOpt.value = county;
            newOpt.textContent = county;
            countySelect.insertBefore(newOpt, countySelect.lastElementChild);
            countySelect.value = county;
            wizardState.county = county;
        }
    }

    // Hide the form list preview
    const listEl = document.getElementById('wizFormList');
    if (listEl) listEl.classList.remove('visible');

    // Disable load button
    const btn = document.getElementById('wizLoadFormsBtn');
    if (btn) btn.disabled = true;

    // Show the wizard that matches the matter type — Open Estate for probate,
    // Open Guardianship for guardianship. Both are inline panel cards; only one
    // is ever visible at a time.
    const probateWizardEl = document.getElementById('openEstateWizard');
    const gWizardEl = document.getElementById('openGuardianshipWizard');
    const isProbate = currentMatter && currentMatter.type === 'probate';
    const isGuardianship = currentMatter && currentMatter.type === 'guardianship';
    if (probateWizardEl) probateWizardEl.style.display = isProbate ? '' : 'none';
    if (gWizardEl) gWizardEl.style.display = isGuardianship ? '' : 'none';

    if (isGuardianship) initGuardianshipWizardForMatter();

    // Update wizard header based on whether this is a new or existing estate
    const titleEl = document.getElementById('wizardTitle');
    const subtitleEl = document.getElementById('wizardSubtitle');
    if (saved && saved.adminType && saved.willType && saved.jurisdiction) {
        if (titleEl) titleEl.textContent = 'Open Estate';
        if (subtitleEl) subtitleEl.textContent = 'Change selections below if needed';
        updateWizardUI();
        // Auto-load the forms so the user doesn't have to click "Load Forms" again
        setTimeout(() => wizardLoadForms(), 50);
    } else {
        if (titleEl) titleEl.textContent = 'Open Estate';
        if (subtitleEl) subtitleEl.textContent = 'Answer these questions to load the correct forms';
    }
}

// ============================================
// FORM SELECTOR & RENDERING
// ============================================

function populateFormSelector() {
    if (!formsConfig || !currentMatter) return;

    const matterType = currentMatter.type || 'probate';
    const prefixes = matterType === 'probate' ? ['P', 'BW'] : ['G'];
    const availableForms = formsConfig.forms.filter(f => prefixes.some(p => f.id.startsWith(p)));
    const bundles = formBundles[matterType] || [];

    // Render bundle buttons
    const bundleContainer = document.getElementById('formBundles');
    bundleContainer.innerHTML = '';
    bundles.forEach(bundle => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bundle-btn';
        btn.textContent = bundle.name;
        btn.addEventListener('click', () => toggleBundle(bundle));
        bundleContainer.appendChild(btn);
    });

    // Render form checklist
    const checklist = document.getElementById('formChecklist');
    checklist.innerHTML = '';
    availableForms.forEach(form => {
        const item = document.createElement('div');
        item.className = 'form-check-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'formCheck_' + form.id;
        cb.value = form.id;
        cb.checked = selectedFormIds.includes(form.id);
        cb.addEventListener('change', () => handleFormCheckChange());

        const label = document.createElement('label');
        label.htmlFor = 'formCheck_' + form.id;
        label.innerHTML = '<span class="form-id">' + form.id + '</span>' + form.name;

        item.appendChild(cb);
        item.appendChild(label);
        checklist.appendChild(item);
    });

    // Render lifecycle section cards (Administration, Closing)
    populateFormSections();
}

function populateFormSections() {
    const matterType = currentMatter ? currentMatter.type || 'probate' : 'probate';
    const matterSections = formSections[matterType];

    const adminEl = document.getElementById('adminSection');
    const closingEl = document.getElementById('closingSection');

    if (!matterSections) {
        if (adminEl) adminEl.style.display = 'none';
        if (closingEl) closingEl.style.display = 'none';
        return;
    }

    // Pick formal vs summary sections based on wizard selections
    const adminType = (currentMatter && currentMatter.wizardSelections && currentMatter.wizardSelections.adminType) || 'formal';
    const sections = matterSections[adminType] || matterSections.formal;

    if (!sections) {
        if (adminEl) adminEl.style.display = 'none';
        if (closingEl) closingEl.style.display = 'none';
        return;
    }

    // Update section headers to reflect the config
    if (sections.administration && adminEl) {
        const h3 = adminEl.querySelector('.section-header h3');
        const sub = adminEl.querySelector('.section-subtitle');
        if (h3) h3.textContent = sections.administration.label;
        if (sub) sub.textContent = sections.administration.subtitle;
    }
    if (sections.closing && closingEl) {
        const h3 = closingEl.querySelector('.section-header h3');
        const sub = closingEl.querySelector('.section-subtitle');
        if (h3) h3.textContent = sections.closing.label;
        if (sub) sub.textContent = sections.closing.subtitle;
    }

    // Render each section
    renderFormSection('adminFormList', sections.administration, adminEl);
    renderFormSection('closingFormList', sections.closing, closingEl);
}

function renderFormSection(containerId, section, sectionEl) {
    if (!section || !sectionEl) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    sectionEl.style.display = '';

    section.formIds.forEach(formId => {
        const formDef = formsConfig.forms.find(f => f.id === formId);
        if (!formDef) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'section-form-btn' + (selectedFormIds.includes(formId) ? ' active' : '');
        btn.dataset.formId = formId;
        btn.innerHTML = '<span class="section-form-name">' + formDef.name + '</span>' +
                         '<span class="section-form-id">' + formId + '</span>';
        btn.addEventListener('click', () => toggleSectionForm(formId));
        container.appendChild(btn);
    });
}

function toggleSectionForm(formId) {
    const idx = selectedFormIds.indexOf(formId);
    if (idx >= 0) {
        selectedFormIds.splice(idx, 1);
    } else {
        selectedFormIds.push(formId);
    }

    // Sync all UI elements
    syncCheckboxes();
    updateBundleButtons();
    updateSectionButtons();
    handleFormSelectionChanged();
}

function updateSectionButtons() {
    document.querySelectorAll('.section-form-btn').forEach(btn => {
        const formId = btn.dataset.formId;
        btn.classList.toggle('active', selectedFormIds.includes(formId));
    });
}

function toggleBundle(bundle) {
    // If all forms in this bundle are already selected, deselect them
    const allSelected = bundle.formIds.every(id => selectedFormIds.includes(id));

    if (allSelected) {
        selectedFormIds = selectedFormIds.filter(id => !bundle.formIds.includes(id));
    } else {
        bundle.formIds.forEach(id => {
            if (!selectedFormIds.includes(id)) {
                selectedFormIds.push(id);
            }
        });
    }

    // Update checkbox states
    syncCheckboxes();
    updateBundleButtons();
    handleFormSelectionChanged();
}

function handleFormCheckChange() {
    // Read current checkbox states
    selectedFormIds = [];
    document.querySelectorAll('#formChecklist input[type="checkbox"]:checked').forEach(cb => {
        selectedFormIds.push(cb.value);
    });
    updateBundleButtons();
    updateSectionButtons();
    handleFormSelectionChanged();
}

function syncCheckboxes() {
    document.querySelectorAll('#formChecklist input[type="checkbox"]').forEach(cb => {
        cb.checked = selectedFormIds.includes(cb.value);
    });
    updateSectionButtons();
}

function updateBundleButtons() {
    const matterType = currentMatter ? currentMatter.type || 'probate' : 'probate';
    const bundles = formBundles[matterType] || [];
    const buttons = document.querySelectorAll('.bundle-btn');

    buttons.forEach((btn, i) => {
        if (i < bundles.length) {
            const allSelected = bundles[i].formIds.every(id => selectedFormIds.includes(id));
            btn.classList.toggle('active', allSelected);
        }
    });
}

function handleFormSelectionChanged() {
    if (selectedFormIds.length === 0) {
        document.getElementById('formFieldsSection').style.display = 'none';
        document.getElementById('formFieldsContainer').innerHTML = '';
        currentFormId = null;
        currentFormData = {};
        return;
    }

    // Use the first selected form as the "primary" for data saving compatibility
    currentFormId = selectedFormIds[0];

    // Merge saved form data from all selected forms
    currentFormData = {};
    selectedFormIds.forEach(formId => {
        if (currentMatter && currentMatter.formData && currentMatter.formData[formId]) {
            const saved = currentMatter.formData[formId];
            Object.keys(saved).forEach(key => {
                // Don't overwrite with empty values
                const val = saved[key];
                if (val !== '' && val !== null && val !== undefined && val !== false) {
                    currentFormData[key] = val;
                }
            });
        }
    });

    renderMergedFormFields();
}

// Canonical attorney profiles. Add new attorneys here, pick per-matter in the
// matter modal via the `attorneyId` field. Matter type drives the default.
// NOTE: Only actual attorneys belong here. Maribel Gannon is a paralegal who
// drafts for Jill — she signs into the app but documents list Jill as
// attorney of record. Do not add Maribel to this dict.
const ATTORNEY_PROFILES = {
    david: {
        label: 'David A. Shulman',
        attorney_name: 'David A. Shulman',
        attorney_email: 'david@ginsbergshulman.com',
        attorney_email_secondary: '',
        attorney_bar_no: '150762',
        attorney_firm: 'Ginsberg Shulman PL',
        attorney_address: '300 SE 2nd St Ste 600\nFort Lauderdale, FL 33301',
        attorney_phone: '954-990-0896'
    },
    jill: {
        label: 'Jill R. Ginsberg',
        attorney_name: 'Jill R. Ginsberg',
        attorney_email: 'jill@ginsbergshulman.com',
        attorney_email_secondary: 'maribel@ginsbergshulman.com',
        attorney_bar_no: '813850',
        attorney_firm: 'Ginsberg Shulman, PL',
        attorney_address: '300 SE 2nd Street, Suite 600\nFort Lauderdale, FL 33301',
        attorney_phone: '954-332-2310'
    }
};

function defaultAttorneyIdForType(matterType) {
    return matterType === 'guardianship' ? 'jill' : 'david';
}

// Accepts either a matter object (preferred — honors matter.attorneyId) or a
// bare matter-type string for legacy callers.
function getAttorneyDefaults(matterOrType) {
    let attorneyId;
    let matterType;
    if (matterOrType && typeof matterOrType === 'object') {
        attorneyId = matterOrType.attorneyId;
        matterType = matterOrType.type;
    } else {
        matterType = matterOrType;
    }
    if (!attorneyId) attorneyId = defaultAttorneyIdForType(matterType);
    const profile = ATTORNEY_PROFILES[attorneyId] || ATTORNEY_PROFILES.david;
    // Strip the UI-only `label` before returning — template data only.
    const { label, ...defaults } = profile;
    return { ...defaults };
}

function getAutoPopulateDefaults() {
    /**
     * Build a map of field defaults from three sources (in priority order):
     * 1. Data entered in OTHER forms for this matter (cross-form sharing)
     * 2. Matter-level data (county, subject name, matterData)
     * 3. Client-level data (petitioner name/address)
     * 4. Attorney defaults (varies by matter type — see getAttorneyDefaults)
     *
     * Every field ever entered on any form for this matter is available
     * to every other form. Enter once, populate everywhere.
     */
    const defaults = {};
    if (!currentClient || !currentMatter) return defaults;

    // --- Layer 1: Pull ALL saved form data from other forms in this matter ---
    const allFormData = currentMatter.formData || {};
    Object.keys(allFormData).forEach(formId => {
        if (formId === currentFormId) return; // current form's own data handled separately
        const saved = allFormData[formId];
        Object.keys(saved).forEach(key => {
            const val = saved[key];
            // Don't overwrite with empty values; do carry over arrays (repeating groups)
            if (val !== '' && val !== null && val !== undefined) {
                defaults[key] = val;
            }
        });
    });

    // --- Layer 2: Matter-level data ---
    defaults.county = currentMatter.county || defaults.county || '';
    defaults.decedent_name = currentMatter.subjectName || defaults.decedent_name || '';
    defaults.decedent_full_name = currentMatter.subjectName || defaults.decedent_full_name || '';
    defaults.aip_name = currentMatter.subjectName || defaults.aip_name || '';
    defaults.file_no = currentMatter.fileNo || defaults.file_no || '';
    defaults.division = currentMatter.division || defaults.division || '';

    const md = currentMatter.matterData || {};
    Object.keys(md).forEach(key => {
        if (md[key]) defaults[key] = md[key];
    });

    // --- Layer 3: Client-level data ---
    const fullName = ((currentClient.firstName || '') + ' ' + (currentClient.lastName || '')).trim();
    if (!defaults.petitioner_name) defaults.petitioner_name = fullName;
    if (!defaults.petitioner_names) defaults.petitioner_names = fullName;
    if (!defaults.petitioner_address) defaults.petitioner_address = currentClient.address || '';

    // --- Layer 3a: Auto-populate petitioners array for multi-petitioner forms ---
    if (!defaults.petitioners || !Array.isArray(defaults.petitioners) || defaults.petitioners.length === 0) {
        defaults.petitioners = [{
            pet_name: fullName,
            pet_address: currentClient.address || '',
            pet_relationship: ''
        }];
    }

    // --- Layer 3a-bis: Auto-populate prs array (PR is almost always the
    // petitioner; user can edit if not). ---
    if (!defaults.prs || !Array.isArray(defaults.prs) || defaults.prs.length === 0) {
        defaults.prs = [{
            pr_name: fullName,
            pr_address: currentClient.address || '',
            pr_is_fl_resident: true,
            pr_relationship: ''
        }];
    }

    // --- Layer 3a-ter: Guardianship — proposed guardian is almost always
    // the petitioner. Auto-populate the flat proposed_guardian_* fields
    // from currentClient on first render. User can edit if a third party
    // is being proposed. ---
    if (!defaults.proposed_guardian_name) defaults.proposed_guardian_name = fullName;
    if (!defaults.proposed_guardian_address) defaults.proposed_guardian_address = currentClient.address || '';

    // --- Layer 3a-quinquies: Caveat — caveator is the firm's client. ---
    if (!defaults.caveator_name) defaults.caveator_name = fullName;
    if (!defaults.caveator_mailing_address) defaults.caveator_mailing_address = currentClient.address || '';
    if (!defaults.caveator_residence_address) defaults.caveator_residence_address = currentClient.address || '';

    // --- Layer 3a-quater: Petitioner short residence (city, state) ---
    // The questionnaire asks "Petitioner's residence (city, state)" as a
    // short text field on G3-010/025/026 — derive from the structured
    // address so the user doesn't have to retype.
    if (!defaults.petitioner_residence) {
        defaults.petitioner_residence = extractCityState(currentClient.address);
    }

    // --- Layer 3b: Auto-derive fields ---
    if (!defaults.affiant_name) defaults.affiant_name = defaults.petitioner_name || fullName;
    if (!defaults.notary_state) defaults.notary_state = 'Florida';
    if (!defaults.notary_county) defaults.notary_county = currentMatter.county || '';

    // --- Layer 4: Attorney defaults (per-matter attorneyId, falls back to type) ---
    const attorneyDefaults = getAttorneyDefaults(currentMatter);
    Object.keys(attorneyDefaults).forEach(key => {
        if (!defaults[key]) defaults[key] = attorneyDefaults[key];
    });

    // --- Layer 4a: Resident agent defaults to the signing attorney ---
    // Always David or Jill in practice; user can still override the text
    // fields if a specific matter calls for someone else.
    if (!defaults.resident_agent_name) {
        defaults.resident_agent_name = attorneyDefaults.attorney_name || '';
    }
    if (!defaults.resident_agent_address) {
        defaults.resident_agent_address = attorneyDefaults.attorney_address || '';
    }

    return defaults;
}

function renderFormFields() {
    // Legacy single-form render — now delegates to merged render
    renderMergedFormFields();
}

function renderMergedFormFields() {
    if (!formsConfig || selectedFormIds.length === 0) return;

    // Pre-populate currentFormData with defaults
    const defaults = getAutoPopulateDefaults();
    Object.keys(defaults).forEach(key => {
        if (!currentFormData[key] && defaults[key]) {
            currentFormData[key] = defaults[key];
        }
    });

    // Apply schema-level default_value for any field that has never been
    // touched (e.g. proposed_guardian_same_as_petitioner defaults to true).
    // This makes visible_if checks see the right initial value — the
    // checkbox renderer also honors default_value visually, but the form
    // data needs to match for the visibility pass to agree.
    selectedFormIds.forEach(formId => {
        const form = formsConfig.forms.find(f => f.id === formId);
        if (!form) return;
        (form.sections || []).forEach(section => {
            (section.fields || []).forEach(field => {
                if (field.default_value !== undefined &&
                    currentFormData[field.name] === undefined) {
                    currentFormData[field.name] = field.default_value;
                }
            });
        });
    });

    const container = document.getElementById('formFieldsContainer');
    container.innerHTML = '';

    // Show selected forms summary tags
    const summary = document.getElementById('selectedFormsSummary');
    summary.innerHTML = '';
    selectedFormIds.forEach(formId => {
        const form = formsConfig.forms.find(f => f.id === formId);
        if (form) {
            const tag = document.createElement('span');
            tag.className = 'selected-form-tag';
            tag.textContent = form.id;
            summary.appendChild(tag);
        }
    });

    // Collect all sections from all selected forms, deduplicating fields by name
    const seenFields = new Set();
    const mergedSections = [];

    selectedFormIds.forEach(formId => {
        const form = formsConfig.forms.find(f => f.id === formId);
        if (!form) return;

        (form.sections || []).forEach(section => {
            const newFields = [];
            section.fields.forEach(field => {
                const fieldKey = field.type === 'repeating_group' ? field.name : field.name;
                if (!seenFields.has(fieldKey)) {
                    seenFields.add(fieldKey);
                    newFields.push(field);
                }
            });

            if (newFields.length > 0) {
                // Check if we already have a section with this title
                const existingSection = mergedSections.find(s => s.title === section.title);
                if (existingSection) {
                    existingSection.fields.push(...newFields);
                } else {
                    mergedSections.push({
                        title: section.title,
                        fields: [...newFields],
                        visible_if: section.visible_if
                    });
                }
            }
        });
    });

    // Render the merged sections
    mergedSections.forEach(section => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'form-section';
        applyVisibleIfAttrs(sectionDiv, section.visible_if, 'form');

        const titleH3 = document.createElement('h3');
        titleH3.textContent = section.title;
        sectionDiv.appendChild(titleH3);

        section.fields.forEach(field => {
            const fieldEl = renderFormField(field);
            sectionDiv.appendChild(fieldEl);
        });

        container.appendChild(sectionDiv);
    });

    // Update generate button text
    const genBtn = document.getElementById('generateDocBtn');
    if (selectedFormIds.length === 1) {
        genBtn.textContent = 'Generate Document';
    } else {
        genBtn.textContent = 'Generate ' + selectedFormIds.length + ' Documents (.zip)';
    }

    document.getElementById('formFieldsSection').style.display = 'block';
    applyConditionalVisibility();
}

// Read a matter-level boolean flag (from matter.matterData). Used by
// `row_lock_unless_matter_flag` on repeating groups — e.g. the PR group
// locks to a single row when the wizard answered "single".
function getMatterFlag(name) {
    return !!(currentMatter && currentMatter.matterData && currentMatter.matterData[name]);
}

// US states for address dropdowns. Alphabetical; includes DC + common
// territories. Blank default = not yet chosen.
const US_STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL',
    'IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE',
    'NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD',
    'TN','TX','UT','VT','VA','WA','WV','WI','WY','PR','VI','GU','AS','MP'
];

// Parse a free-text address (auto-populated client default, legacy matter
// data, or pasted string) into the structured shape. Returns null only when
// no US state + zip pattern can be found at all. Lenient about commas:
// users often type "14 Canfield Way Avon, CT 06001" or even "...Avon CT
// 06001" without separators. The parser anchors on the trailing 2-letter
// state + 5-digit zip and best-effort splits everything before that.
//   "4521 NE 12th Ave, Fort Lauderdale, FL 33334"     → fully structured
//   "4521 NE 12th Ave\nFort Lauderdale, FL 33334"     → fully structured
//   "1200 SW 3rd St, Apt 204, Fort Lauderdale, FL 33312" → with line2
//   "14 Canfield Way Avon, CT 06001"                  → city left blank
//                                                       (user moves it)
function parseStringToStructuredAddress(s) {
    if (!s || typeof s !== 'string') return null;
    const trimmed = s.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/\s*\n+\s*/g, ', ');

    // Anchor on the trailing state + zip — required for a US match.
    const tail = normalized.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
    if (!tail) return null;
    const state = tail[1];
    const zip = tail[2];
    const before = normalized.slice(0, tail.index).replace(/[,\s]+$/, '').trim();
    if (!before) return null;

    // If there are commas, the last comma-separated chunk is the city and
    // the rest is street (+ optional line2). Without commas, we can't
    // reliably split city out — dump the whole thing into street and let
    // the user move pieces around. Better than refusing to parse.
    let street = '', line2 = '', city = '';
    const parts = before.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
        city = parts[parts.length - 1];
        const beforeCity = parts.slice(0, -1);
        street = beforeCity[0] || '';
        line2 = beforeCity.length > 1 ? beforeCity.slice(1).join(', ') : '';
    } else {
        street = parts[0] || before;
    }
    return { street, line2, city, state, zip, foreign: false };
}

// Render a structured address as a compact grid. Shape:
//   { street, line2, city, state, zip, foreign, foreign_text }
// Works for both top-level fields and repeating-group subfields. The
// free-text toggle swaps the US grid for a textarea — for non-US
// addresses or anything that doesn't fit the standard street/city/state/zip
// shape.
function renderAddressField(opts) {
    // opts: { value, label, dataBase (object with data-* attrs for inputs),
    //         addressIdPrefix (unique id prefix) }
    const wrap = document.createElement('div');
    wrap.className = 'address-field';
    if (opts.label) {
        const labelEl = document.createElement('label');
        labelEl.className = 'address-label';
        labelEl.textContent = opts.label;
        wrap.appendChild(labelEl);
    }

    // String values come from two places: (a) auto-populate (the seed
    // client.address is a string), and (b) legacy matters created before the
    // structured-address rollout. The lenient parser anchors on the trailing
    // state + zip and almost always extracts something usable.
    //
    // The free-text toggle defaults to UNCHECKED — David's explicit
    // preference. Genuine US addresses are virtually universal here; the
    // toggle is for the rare non-US / non-standard case. For saved values
    // that came in as { foreign: true, foreign_text: "..." }, try to upgrade
    // them to structured by re-running the parser on the stored text — this
    // converts older foreign-marked records that were really just
    // unrecognized US formats.
    let val;
    if (opts.value && typeof opts.value === 'object') {
        val = { ...opts.value };
        const hasStructured = val.street || val.city || val.state || val.zip;
        if (val.foreign === true && !hasStructured) {
            // Saved with foreign:true but the structured fields are empty.
            // Try to upgrade by re-parsing foreign_text. If we can't (no
            // foreign text or it's truly non-US), drop the foreign flag so
            // the toggle still defaults unchecked — David's preference is
            // for the structured grid to be the default view always.
            const parsed = val.foreign_text
                ? parseStringToStructuredAddress(val.foreign_text)
                : null;
            if (parsed) {
                val = { ...parsed, foreign_text: val.foreign_text };
            } else {
                val.foreign = false;
            }
        }
    } else if (typeof opts.value === 'string' && opts.value.trim()) {
        val = parseStringToStructuredAddress(opts.value)
            || { foreign_text: opts.value };  // toggle unchecked, data preserved
    } else {
        val = {};
    }
    const isForeign = val.foreign === true;

    const mkInput = (key, attrs) => {
        const input = document.createElement('input');
        input.type = attrs.type || 'text';
        input.className = 'form-field-input address-sub-input';
        input.dataset.addressKey = key;
        Object.keys(opts.dataBase).forEach(k => { input.dataset[k] = opts.dataBase[k]; });
        if (attrs.placeholder) input.placeholder = attrs.placeholder;
        if (attrs.maxLength) input.maxLength = attrs.maxLength;
        if (attrs.pattern) input.pattern = attrs.pattern;
        if (attrs.inputMode) input.inputMode = attrs.inputMode;
        const v = val[key];
        input.value = (v === null || v === undefined) ? '' : v;
        return input;
    };

    // US grid
    const usGrid = document.createElement('div');
    usGrid.className = 'address-grid';
    usGrid.style.display = isForeign ? 'none' : '';

    usGrid.appendChild(mkInput('street', { placeholder: 'Street address' }));
    usGrid.appendChild(mkInput('line2', { placeholder: 'Apt / Suite (optional)' }));

    const row = document.createElement('div');
    row.className = 'address-row-3';
    row.appendChild(mkInput('city', { placeholder: 'City' }));

    const stateSelect = document.createElement('select');
    stateSelect.className = 'form-field-input address-sub-input';
    stateSelect.dataset.addressKey = 'state';
    Object.keys(opts.dataBase).forEach(k => { stateSelect.dataset[k] = opts.dataBase[k]; });
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = 'State';
    stateSelect.appendChild(blank);
    US_STATES.forEach(s => {
        const o = document.createElement('option');
        o.value = s; o.textContent = s;
        if ((val.state || '') === s) o.selected = true;
        stateSelect.appendChild(o);
    });
    row.appendChild(stateSelect);
    row.appendChild(mkInput('zip', {
        placeholder: 'Zip', maxLength: 10, pattern: '\\d{5}(-\\d{4})?', inputMode: 'numeric'
    }));
    usGrid.appendChild(row);
    wrap.appendChild(usGrid);

    // Foreign textarea
    const foreignWrap = document.createElement('div');
    foreignWrap.className = 'address-foreign-wrap';
    foreignWrap.style.display = isForeign ? '' : 'none';
    const foreignTA = document.createElement('textarea');
    foreignTA.className = 'form-field-input address-sub-input';
    foreignTA.dataset.addressKey = 'foreign_text';
    Object.keys(opts.dataBase).forEach(k => { foreignTA.dataset[k] = opts.dataBase[k]; });
    foreignTA.placeholder = 'Full foreign address (street, city, region, postal code, country)';
    foreignTA.rows = 3;
    foreignTA.value = val.foreign_text || '';
    foreignWrap.appendChild(foreignTA);
    wrap.appendChild(foreignWrap);

    // Foreign toggle
    const toggleWrap = document.createElement('label');
    toggleWrap.className = 'address-foreign-toggle';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'form-field-input address-sub-input';
    toggle.dataset.addressKey = 'foreign';
    Object.keys(opts.dataBase).forEach(k => { toggle.dataset[k] = opts.dataBase[k]; });
    toggle.checked = isForeign;
    toggle.addEventListener('change', () => {
        usGrid.style.display = toggle.checked ? 'none' : '';
        foreignWrap.style.display = toggle.checked ? '' : 'none';

        // Switching FROM free-text back to the structured grid: if the
        // structured fields are empty, prefill from (a) whatever the user
        // typed in the free-text box (if it parses), or (b) the value the
        // field was originally populated with — typically the client's
        // address. This recovers from cases where the parser didn't catch
        // the format on first render.
        if (!toggle.checked) {
            const inputs = usGrid.querySelectorAll('[data-address-key]');
            const allEmpty = Array.from(inputs).every(i => !i.value);
            if (allEmpty) {
                const candidate = parseStringToStructuredAddress(foreignTA.value)
                    || parseStringToStructuredAddress(typeof opts.value === 'string' ? opts.value : '');
                if (candidate) {
                    inputs.forEach(input => {
                        const key = input.dataset.addressKey;
                        if (candidate[key] !== undefined && candidate[key] !== '') {
                            input.value = candidate[key];
                        }
                    });
                }
            }
        }
    });
    toggleWrap.appendChild(toggle);
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Use free-text (foreign or non-standard address)';
    toggleWrap.appendChild(toggleLabel);
    wrap.appendChild(toggleWrap);

    return wrap;
}

// Pull just the "City, State" piece out of an address (object or string).
// Used for short residence-style fields like petitioner_residence that
// take a different shape than the full mailing address.
function extractCityState(raw) {
    if (!raw) return '';
    let obj = null;
    if (typeof raw === 'object') obj = raw;
    else if (typeof raw === 'string') obj = parseStringToStructuredAddress(raw);
    if (!obj) return '';
    const city = (obj.city || '').trim();
    const state = (obj.state || '').trim();
    return [city, state].filter(Boolean).join(', ');
}

// Format a structured address object into a single-line string for template
// rendering. Falls back to free-text for foreign addresses. Accepts legacy
// plain-string addresses unchanged.
function formatAddressValue(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw !== 'object') return String(raw);
    if (raw.foreign && (raw.foreign_text || '').trim()) {
        return String(raw.foreign_text).trim();
    }
    const parts = [];
    const streetLine = [raw.street, raw.line2].filter(s => s && s.trim()).join(', ');
    if (streetLine) parts.push(streetLine);
    const cityStateZip = [
        (raw.city || '').trim(),
        [(raw.state || '').trim(), (raw.zip || '').trim()].filter(Boolean).join(' ')
    ].filter(Boolean).join(', ');
    if (cityStateZip) parts.push(cityStateZip);
    return parts.join(', ');
}

// Walk every field/subfield declared as type="address" across the currently
// selected forms, so prepareTemplateData can format them uniformly.
function collectAddressFieldNames() {
    const topLevel = new Set();
    const subfields = new Map();
    if (!formsConfig) return { topLevel, subfields };
    selectedFormIds.forEach(formId => {
        const form = formsConfig.forms.find(f => f.id === formId);
        if (!form) return;
        (form.sections || []).forEach(section => {
            (section.fields || []).forEach(field => {
                if (field.type === 'address') topLevel.add(field.name);
                if (field.type === 'repeating_group' && Array.isArray(field.subfields)) {
                    field.subfields.forEach(sf => {
                        if (sf.type === 'address') {
                            if (!subfields.has(field.name)) subfields.set(field.name, new Set());
                            subfields.get(field.name).add(sf.name);
                        }
                    });
                }
            });
        });
    });
    return { topLevel, subfields };
}

// Tag a field container with visibility metadata. applyConditionalVisibility()
// reads these after every field change and toggles display.
// Three shapes are supported:
//   { field: 'other_field', equals: true }       — read currentFormData
//   { matter_flag: 'is_ancillary', equals: true } — read currentMatter.matterData
//   { all: [ {...}, {...} ] }                     — AND of the simple shapes above
function applyVisibleIfAttrs(el, visibleIf, scope) {
    if (!visibleIf) return;
    if (Array.isArray(visibleIf.all)) {
        el.dataset.visibleIfAll = JSON.stringify(visibleIf.all);
        el.dataset.visibleIfScope = scope || 'form';
        return;
    }
    if (visibleIf.matter_flag) {
        el.dataset.visibleIfMatterFlag = visibleIf.matter_flag;
    } else if (visibleIf.field) {
        el.dataset.visibleIfField = visibleIf.field;
        el.dataset.visibleIfScope = scope || 'form';
    } else {
        return;
    }
    if ('equals' in visibleIf) el.dataset.visibleIfEquals = JSON.stringify(visibleIf.equals);
    if ('not_equals' in visibleIf) el.dataset.visibleIfNotEquals = JSON.stringify(visibleIf.not_equals);
}

function renderFormField(field) {
    const container = document.createElement('div');
    container.className = 'form-field-container';
    applyVisibleIfAttrs(container, field.visible_if, 'form');

    if (field.type === 'info') {
        const callout = document.createElement('div');
        callout.className = 'field-info-callout field-info-' + (field.severity || 'info');
        callout.innerHTML = field.content;
        container.appendChild(callout);
    } else if (field.type === 'address') {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        fieldDiv.appendChild(renderAddressField({
            value: currentFormData[field.name],
            label: field.label,
            dataBase: { field: field.name, type: 'address' }
        }));
        container.appendChild(fieldDiv);
    } else if (field.type === 'text' || field.type === 'number' || field.type === 'date') {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        const label = document.createElement('label');
        label.htmlFor = 'form_' + field.name;
        label.textContent = field.label;
        const input = document.createElement('input');
        if (field.type === 'number') {
            input.type = 'number';
            input.inputMode = 'decimal';
            input.step = field.step || 'any';
        } else if (field.type === 'date') {
            input.type = 'date';
        } else {
            input.type = 'text';
        }
        // Optional per-field input attributes (e.g. SSN last-4 pattern).
        if (field.pattern) input.pattern = field.pattern;
        if (field.maxlength) input.maxLength = field.maxlength;
        if (field.inputmode) input.inputMode = field.inputmode;
        if (field.placeholder) input.placeholder = field.placeholder;
        input.id = 'form_' + field.name;
        input.className = 'form-field-input';
        input.dataset.field = field.name;
        input.dataset.type = field.type;
        const v = currentFormData[field.name];
        input.value = (v === null || v === undefined) ? '' : v;
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(input);
        container.appendChild(fieldDiv);
    } else if (field.type === 'textarea') {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        const label = document.createElement('label');
        label.htmlFor = 'form_' + field.name;
        label.textContent = field.label;
        const textarea = document.createElement('textarea');
        textarea.id = 'form_' + field.name;
        textarea.className = 'form-field-input';
        textarea.dataset.field = field.name;
        textarea.value = currentFormData[field.name] || '';
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(textarea);
        container.appendChild(fieldDiv);
    } else if (field.type === 'select') {
        // Validated dropdown — `options` is an array of { value, label }
        // (label optional; falls back to value). Used for fields where the
        // answer is one of a small fixed set, e.g. the resident agent must
        // be either David or Jill.
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        const label = document.createElement('label');
        label.htmlFor = 'form_' + field.name;
        label.textContent = field.label;
        const select = document.createElement('select');
        select.id = 'form_' + field.name;
        select.className = 'form-field-input';
        select.dataset.field = field.name;
        select.dataset.type = 'select';
        const currentVal = currentFormData[field.name];
        if (field.placeholder || !field.options || field.options.length === 0) {
            const blank = document.createElement('option');
            blank.value = '';
            blank.textContent = field.placeholder || '-- Select --';
            select.appendChild(blank);
        }
        (field.options || []).forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label || opt.value;
            if (currentVal === opt.value) o.selected = true;
            select.appendChild(o);
        });
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(select);
        container.appendChild(fieldDiv);
    } else if (field.type === 'checkbox') {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'checkbox-item';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'form_' + field.name;
        input.className = 'form-field-input';
        input.dataset.field = field.name;
        // `default_value: true` precheck-style: if the field has never been
        // touched (currentFormData has no entry), use the schema default.
        // An explicit `false` always wins — the user's "no, untick this"
        // choice is preserved.
        let cbVal = currentFormData[field.name];
        if (cbVal === undefined && field.default_value !== undefined) {
            cbVal = field.default_value;
        }
        input.checked = cbVal === true;
        const label = document.createElement('label');
        label.htmlFor = 'form_' + field.name;
        label.textContent = field.label;
        fieldDiv.appendChild(input);
        fieldDiv.appendChild(label);
        container.appendChild(fieldDiv);
    } else if (field.type === 'repeating_group') {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'repeating-group';
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.fontWeight = '600';
        label.style.marginBottom = '1rem';
        label.textContent = field.label;
        groupDiv.appendChild(label);

        // Row-lock: wizard-set matter flag (e.g. multiple_prs) determines
        // whether the user can add extra rows. When false, cap to 1 row and
        // hide the Add button. Existing extra data is preserved but not
        // rendered (so flipping the wizard back to "multiple" doesn't lose it).
        // When locked AND no rows exist, render one empty row so the user
        // always has somewhere to type — otherwise the field disappears.
        const locked = field.row_lock_unless_matter_flag &&
                       !getMatterFlag(field.row_lock_unless_matter_flag);
        const items = currentFormData[field.name] || [];
        const visibleItems = locked
            ? (items.length > 0 ? items.slice(0, 1) : [{}])
            : items;

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'repeating-group-items';
        itemsContainer.id = 'group_' + field.name;

        visibleItems.forEach((item, index) => {
            itemsContainer.appendChild(renderRepeatingGroupItem(field, item, index));
        });
        groupDiv.appendChild(itemsContainer);

        if (!locked) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'add-row-btn';
            addBtn.textContent = '+ Add Row';
            addBtn.dataset.field = field.name;
            groupDiv.appendChild(addBtn);
        }
        container.appendChild(groupDiv);
    }

    return container;
}

function renderRepeatingGroupItem(field, item, index) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'repeating-group-item';

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'repeating-group-item-fields';

    field.subfields.forEach(subfield => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'repeating-group-item-field';
        // Subfield visibility is per-row — visible_if.subfield references
        // another subfield name in the same row (e.g. ben_year_of_birth
        // hidden unless ben_is_minor checked).
        applyVisibleIfAttrs(fieldDiv, subfield.visible_if, 'row');
        if (subfield.visible_if) {
            fieldDiv.dataset.visibleIfRowIndex = index;
            fieldDiv.dataset.visibleIfParentField = field.name;
        }

        const input = document.createElement('input');
        input.className = 'form-field-input';
        input.dataset.field = field.name;
        input.dataset.subfield = subfield.name;
        input.dataset.index = index;
        input.dataset.type = subfield.type || 'text';

        if (subfield.type === 'address') {
            // Structured address inside a repeating-group row. Label + grid.
            fieldDiv.classList.add('address-subfield');
            fieldDiv.appendChild(renderAddressField({
                value: item[subfield.name],
                label: subfield.label,
                dataBase: {
                    field: field.name,
                    subfield: subfield.name,
                    index: index,
                    type: 'address'
                }
            }));
        } else if (subfield.type === 'checkbox') {
            // Inline checkbox + label, same pattern as top-level checkbox.
            fieldDiv.classList.add('checkbox-item');
            input.type = 'checkbox';
            input.checked = item[subfield.name] === true;
            const label = document.createElement('label');
            label.textContent = subfield.label;
            fieldDiv.appendChild(input);
            fieldDiv.appendChild(label);
        } else {
            const label = document.createElement('label');
            label.textContent = subfield.label;
            if (subfield.type === 'number') {
                input.type = 'number';
                input.inputMode = 'decimal';
                input.step = subfield.step || 'any';
            } else if (subfield.type === 'date') {
                input.type = 'date';
            } else {
                input.type = 'text';
            }
            if (subfield.pattern) input.pattern = subfield.pattern;
            if (subfield.maxlength) input.maxLength = subfield.maxlength;
            if (subfield.inputmode) input.inputMode = subfield.inputmode;
            if (subfield.placeholder) input.placeholder = subfield.placeholder;
            const v = item[subfield.name];
            input.value = (v === null || v === undefined) ? '' : v;
            fieldDiv.appendChild(label);
            fieldDiv.appendChild(input);
        }
        fieldsContainer.appendChild(fieldDiv);
    });

    itemDiv.appendChild(fieldsContainer);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.dataset.field = field.name;
    removeBtn.dataset.index = index;
    itemDiv.appendChild(removeBtn);

    return itemDiv;
}

// Walks visibility-tagged containers and toggles display based on
// currentFormData (form-scoped) or per-row data (row-scoped). Called after
// every collectFormData() so toggling a condition field re-evaluates
// downstream visibility immediately.
function applyConditionalVisibility() {
    const container = document.getElementById('formFieldsContainer');
    if (!container) return;
    container.querySelectorAll('[data-visible-if-field], [data-visible-if-matter-flag], [data-visible-if-all]').forEach(el => {
        const scope = el.dataset.visibleIfScope || 'form';
        const parent = el.dataset.visibleIfParentField;
        const idx = parseInt(el.dataset.visibleIfRowIndex, 10);
        const evalSimple = (cond) => {
            let actual;
            if (cond.matter_flag) {
                const md = (currentMatter && currentMatter.matterData) || {};
                actual = md[cond.matter_flag];
            } else if (cond.field) {
                if (scope === 'row') {
                    const row = (currentFormData[parent] || [])[idx] || {};
                    actual = row[cond.field];
                } else {
                    actual = currentFormData[cond.field];
                }
            }
            if ('equals' in cond) return actual === cond.equals;
            if ('not_equals' in cond) return actual !== cond.not_equals;
            return true;
        };
        let show = true;
        if (el.dataset.visibleIfAll) {
            show = JSON.parse(el.dataset.visibleIfAll).every(evalSimple);
        } else {
            const cond = {};
            if (el.dataset.visibleIfMatterFlag) cond.matter_flag = el.dataset.visibleIfMatterFlag;
            if (el.dataset.visibleIfField) cond.field = el.dataset.visibleIfField;
            if ('visibleIfEquals' in el.dataset) cond.equals = JSON.parse(el.dataset.visibleIfEquals);
            if ('visibleIfNotEquals' in el.dataset) cond.not_equals = JSON.parse(el.dataset.visibleIfNotEquals);
            show = evalSimple(cond);
        }
        el.style.display = show ? '' : 'none';
    });
}

function addRepeatingGroupRow(fieldName) {
    if (!currentFormData[fieldName]) currentFormData[fieldName] = [];

    const form = formsConfig.forms.find(f => f.id === currentFormId);
    const field = (form.sections || []).flatMap(s => s.fields).find(f => f.name === fieldName);
    const newItem = {};
    field.subfields.forEach(sf => { newItem[sf.name] = ''; });
    currentFormData[fieldName].push(newItem);

    const container = document.getElementById('group_' + fieldName);
    const index = currentFormData[fieldName].length - 1;
    container.appendChild(renderRepeatingGroupItem(field, newItem, index));
    saveFormDataToMatter();
}

function removeRepeatingGroupRow(fieldName, index) {
    if (currentFormData[fieldName]) {
        currentFormData[fieldName].splice(index, 1);
        renderFormFields();
        saveFormDataToMatter();
    }
}

function collectFormData() {
    const formData = {};

    // Coerce a raw input value based on the declared field type. Number
    // fields store as a real Number (or null when blank) so later
    // calculations (e.g. estate total) don't need to reparse strings.
    const coerce = (input) => {
        if (input.type === 'checkbox') return input.checked;
        if (input.dataset.type === 'number' || input.type === 'number') {
            const raw = input.value;
            if (raw === '' || raw === null || raw === undefined) return null;
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
        }
        return input.value;
    };

    // Ensure a structured address object exists at data[fieldName]
    // (top-level) or inside a repeating-group row.
    const ensureAddressContainer = (fieldName, indexAttr, subfield) => {
        if (indexAttr !== undefined && indexAttr !== null && indexAttr !== '') {
            const idx = parseInt(indexAttr, 10);
            if (!formData[fieldName]) formData[fieldName] = [];
            if (!formData[fieldName][idx]) formData[fieldName][idx] = {};
            if (!formData[fieldName][idx][subfield] || typeof formData[fieldName][idx][subfield] !== 'object') {
                formData[fieldName][idx][subfield] = {};
            }
            return formData[fieldName][idx][subfield];
        }
        if (!formData[fieldName] || typeof formData[fieldName] !== 'object' || Array.isArray(formData[fieldName])) {
            formData[fieldName] = {};
        }
        return formData[fieldName];
    };

    // Sub-inputs of an address field are collected separately — each has
    // data-address-key identifying which part of the address it fills.
    document.querySelectorAll('#formFieldsContainer .address-sub-input').forEach(input => {
        const key = input.dataset.addressKey;
        const fieldName = input.dataset.field;
        const subfield = input.dataset.subfield;
        const indexAttr = input.dataset.index;
        const container = ensureAddressContainer(fieldName, indexAttr, subfield);
        if (input.type === 'checkbox') {
            container[key] = input.checked;
        } else {
            container[key] = input.value;
        }
    });

    document.querySelectorAll('#formFieldsContainer .form-field-input').forEach(input => {
        // Address sub-inputs are handled above.
        if (input.classList.contains('address-sub-input')) return;
        if (!input.dataset.index) {
            formData[input.dataset.field] = coerce(input);
        }
    });

    document.querySelectorAll('#formFieldsContainer .repeating-group-item-field input').forEach(input => {
        if (input.classList.contains('address-sub-input')) return;
        const field = input.dataset.field;
        const subfield = input.dataset.subfield;
        const index = parseInt(input.dataset.index, 10);
        if (!formData[field]) formData[field] = [];
        if (!formData[field][index]) formData[field][index] = {};
        formData[field][index][subfield] = coerce(input);
    });

    currentFormData = formData;
    applyConditionalVisibility();
    saveFormDataToMatter();
}

function saveFormDataToMatter() {
    if (!currentMatter) return;
    if (!currentMatter.formData) currentMatter.formData = {};

    // Save the shared data to ALL selected forms (so cross-form sharing works)
    const formsToSave = selectedFormIds.length > 0 ? selectedFormIds : (currentFormId ? [currentFormId] : []);
    formsToSave.forEach(formId => {
        currentMatter.formData[formId] = { ...currentFormData };
    });

    saveClientsToStorage();
}

// ============================================
// DOCUMENT GENERATION
// ============================================

async function generateDocuments() {
    const formsToGenerate = selectedFormIds.length > 0 ? selectedFormIds : (currentFormId ? [currentFormId] : []);

    if (!currentClient || !currentMatter || formsToGenerate.length === 0) {
        showNotification('Please select at least one form', 'error');
        return;
    }

    showLoading();

    try {
        const templateData = prepareTemplateData();
        const subjectName = (currentMatter.subjectName || 'Form').replace(/\s+/g, '_');
        const dateStr = new Date().toISOString().split('T')[0];

        if (formsToGenerate.length === 1) {
            // Single form — download .docx directly (no zip)
            const form = formsConfig.forms.find(f => f.id === formsToGenerate[0]);
            if (!form) throw new Error('Form configuration not found');

            const blob = await renderSingleDoc(form, templateData);
            const fileName = makeDocFileName(subjectName, form, dateStr);
            window.saveAs(blob, fileName);
            showNotification('Document generated', 'success');
        } else {
            // Multiple forms — bundle into a .zip
            const zipFile = new window.PizZip();

            for (const formId of formsToGenerate) {
                const form = formsConfig.forms.find(f => f.id === formId);
                if (!form) {
                    console.warn('Skipping unknown form:', formId);
                    continue;
                }

                const blob = await renderSingleDoc(form, templateData);
                const arrayBuf = await blob.arrayBuffer();
                const fileName = makeDocFileName(subjectName, form, dateStr);
                zipFile.file(fileName, arrayBuf);
            }

            const zipBlob = zipFile.generate({
                type: 'blob',
                mimeType: 'application/zip'
            });
            const zipName = subjectName + '_' + dateStr + '.zip';
            window.saveAs(zipBlob, zipName);
            showNotification(formsToGenerate.length + ' documents generated', 'success');
        }

        showLoading(false);
    } catch (error) {
        console.error('Error generating documents:', error);
        showNotification('Failed to generate documents: ' + error.message, 'error');
        showLoading(false);
    }
}

async function renderSingleDoc(form, templateData) {
    const response = await fetch(form.template);
    if (!response.ok) throw new Error('Failed to fetch template: ' + form.id);
    const arrayBuffer = await response.arrayBuffer();

    // PDF passthrough: the clerk's official PDF is bundled unchanged.
    // Used for Broward mandatory checklists and affidavits where questionnaire
    // fields would be unanswerable at drafting time. Future phase: re-integrate
    // as a pre-filing review step with rule-violation warnings.
    if (form.delivery === 'pdf_passthrough') {
        return new Blob([arrayBuffer], { type: 'application/pdf' });
    }

    const zip = new window.PizZip(arrayBuffer);
    const doc = new window.docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: function() { return ''; }
    });
    doc.setData(templateData);
    doc.render();

    return doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
}

// Format an ISO "YYYY-MM-DD" date string into "Month D, YYYY" for template
// rendering. Accepts already-formatted strings (returns them unchanged) so
// legacy free-text date fields still work.
function formatDateFieldValue(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    const s = String(raw);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return s; // Not ISO — pass through.
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (!months[mo - 1]) return s;
    return months[mo - 1] + ' ' + d + ', ' + y;
}

// Collect every field/subfield name declared as type "date" across the
// currently selected forms. prepareTemplateData uses this to ISO → prose
// convert all date inputs uniformly.
function collectDateFieldNames() {
    const topLevel = new Set();
    const subfields = new Map(); // parent -> Set(subfield names)
    if (!formsConfig) return { topLevel, subfields };
    selectedFormIds.forEach(formId => {
        const form = formsConfig.forms.find(f => f.id === formId);
        if (!form) return;
        (form.sections || []).forEach(section => {
            (section.fields || []).forEach(field => {
                if (field.type === 'date') topLevel.add(field.name);
                if (field.type === 'repeating_group' && Array.isArray(field.subfields)) {
                    field.subfields.forEach(sf => {
                        if (sf.type === 'date') {
                            if (!subfields.has(field.name)) subfields.set(field.name, new Set());
                            subfields.get(field.name).add(sf.name);
                        }
                    });
                }
            });
        });
    });
    return { topLevel, subfields };
}

function prepareTemplateData() {
    const data = {};

    // Matter-level fields (auto-populate into templates)
    data.county = currentMatter.county || '';
    // Caption-only variant: always rendered ALL CAPS (e.g., "BROWARD COUNTY,
    // FLORIDA"). Body-text references to {county} keep the matter's original
    // casing.
    data.county_caption = (currentMatter.county || '').toUpperCase();
    data.decedent_name = currentMatter.subjectName || '';
    data.aip_name = currentMatter.subjectName || '';
    data.aip_name_upper = (currentMatter.subjectName || '').toUpperCase();
    data.file_no = currentMatter.fileNo || '';
    data.division = currentMatter.division || 'Probate';

    // County-specific AI-certification flags (per 2026 local AOs). Templates
    // wrap the certification text in {#county_is_broward}...{/county_is_broward}
    // or {#county_is_miami_dade}...{/county_is_miami_dade} so it renders only
    // in filings headed for those circuits.
    const cty = (currentMatter.county || '').toLowerCase();
    data.county_is_broward = cty === 'broward';
    data.county_is_miami_dade = cty === 'miami-dade' || cty === 'miami dade';

    // Client-level fields
    data.petitioner_name = ((currentClient.firstName || '') + ' ' + (currentClient.lastName || '')).trim();
    // currentClient.address can be string (legacy) or object (structured) —
    // normalize to a single-line string for template rendering. Forms whose
    // own petitioner_address field is type=address get this re-normalized
    // by the formatAddressValue pass later, which is idempotent on strings.
    data.petitioner_address = formatAddressValue(currentClient.address);

    // Attorney defaults (per-matter attorneyId, falls back to type)
    const attorneyDefaults = getAttorneyDefaults(currentMatter);
    Object.keys(attorneyDefaults).forEach(key => {
        data[key] = attorneyDefaults[key];
    });

    // Merge matter-level data (ward residence, etc.)
    const md = currentMatter.matterData || {};
    Object.keys(md).forEach(key => {
        if (md[key]) data[key] = md[key];
    });

    // Pull from sibling forms so this form sees data entered elsewhere in the matter
    const allFormData = currentMatter.formData || {};
    Object.keys(allFormData).forEach(formId => {
        if (formId === currentFormId) return;
        const saved = allFormData[formId];
        Object.keys(saved).forEach(key => {
            const val = saved[key];
            if (val !== '' && val !== null && val !== undefined) {
                data[key] = val;
            }
        });
    });

    // Form-specific fields (current form wins over sibling forms)
    Object.keys(currentFormData).forEach(key => {
        const value = currentFormData[key];
        if (typeof value === 'boolean') {
            // Keep the raw boolean for docxtemplater conditionals ({#field}...{/field})
            data[key] = value;
            // Also emit legacy checkbox-style rendering for older templates that use {field_check}
            data[key + '_check'] = value ? '(X)' : '(  )';
        } else if (Array.isArray(value)) {
            data[key] = value;
        } else {
            data[key] = value || '';
        }
    });

    // ---- Smart-template derived fields ----
    // Synthesize petitioners/prs arrays from single-name fallbacks so smart
    // templates (P3-PETITION/P3-ORDER/P3-LETTERS/P3-OATH) work uniformly.
    if (!Array.isArray(data.petitioners) || data.petitioners.length === 0) {
        if (data.petitioner_name) {
            data.petitioners = [{
                pet_name: data.petitioner_name,
                pet_address: data.petitioner_address || '',
                pet_interest: data.petitioner_interest || ''
            }];
        }
    }
    if (!Array.isArray(data.prs) || data.prs.length === 0) {
        if (data.pr_name) {
            data.prs = [{
                pr_name: data.pr_name,
                pr_address: data.pr_address || '',
                pr_is_fl_resident: data.pr_is_fl_resident !== false,
                pr_relationship: data.pr_relationship || ''
            }];
        }
    }

    // Petitioner == PR: when the "Petitioner is same as PR(s)" checkbox is on,
    // mirror PR rows into petitioners so the user doesn't enter both.
    if (data.petitioner_same_as_pr === true && Array.isArray(data.prs)) {
        data.petitioners = data.prs
            .filter(pr => (pr.pr_name || '').trim())
            .map(pr => ({
                pet_name: pr.pr_name || '',
                pet_address: pr.pr_address || '',
                pet_interest: 'the nominated personal representative'
            }));
    }

    // Guardianship: proposed guardian == petitioner — when the checkbox is on
    // (default), mirror petitioner_name / petitioner_address into the proposed
    // guardian fields. Means the user doesn't have to fill them twice and the
    // questionnaire can hide the duplicate inputs.
    if (data.proposed_guardian_same_as_petitioner === true) {
        data.proposed_guardian_name = data.petitioner_name || data.proposed_guardian_name || '';
        data.proposed_guardian_address = data.petitioner_address || data.proposed_guardian_address || '';
    }

    // Venue reason: compose prose from checkbox selections (§733.101) + free
    // "Other" text. Multiple boxes can be checked (rare but legal).
    const venueParts = [];
    if (data.venue_reason_type_domicile_fl) {
        venueParts.push('the decedent was domiciled in this county at the time of death');
    }
    if (data.venue_reason_type_property) {
        venueParts.push('the decedent was not a Florida resident but had property in this county at the time of death');
    }
    if (data.venue_reason_type_debtor) {
        venueParts.push('the decedent was not a Florida resident and had no property in Florida, but a debtor of the decedent resides in this county');
    }
    if (data.venue_reason_other && String(data.venue_reason_other).trim()) {
        venueParts.push(String(data.venue_reason_other).trim());
    }
    if (venueParts.length) {
        data.venue_reason = venueParts.join('; also, ');
    }

    // Beneficiary year-of-birth: emit "N/A" when ben_is_minor is falsy so the
    // rendered table has a consistent placeholder instead of an empty cell.
    if (Array.isArray(data.beneficiaries)) {
        data.beneficiaries = data.beneficiaries.map(ben => {
            const isMinor = ben.ben_is_minor === true;
            const year = (ben.ben_year_of_birth || '').toString().trim();
            return {
                ...ben,
                ben_year_of_birth: isMinor ? (year || '') : 'N/A'
            };
        });
    }

    // Derive joined name strings
    if (!data.petitioner_names) {
        data.petitioner_names = Array.isArray(data.petitioners)
            ? data.petitioners.map(p => p.pet_name).filter(Boolean).join(' and ')
            : (data.petitioner_name || '');
    }
    if (!data.pr_names) {
        data.pr_names = Array.isArray(data.prs)
            ? data.prs.map(p => p.pr_name).filter(Boolean).join(' and ')
            : (data.pr_name || '');
    }
    // Single-PR templates (P3-PETITION, etc.) read top-level pr_address /
    // pr_is_fl_resident / pr_relationship. Hoist from prs[0] when the
    // questionnaire wrote into the array but didn't set top-level values.
    // Without this, an FL-resident PR renders inverted ("is not a resident
    // of Florida but is related to the decedent as ...") with empty
    // relationship.
    if (Array.isArray(data.prs) && data.prs[0]) {
        const first = data.prs[0];
        if (data.pr_address === undefined || data.pr_address === '') {
            data.pr_address = first.pr_address || '';
        }
        if (data.pr_is_fl_resident === undefined) {
            data.pr_is_fl_resident = first.pr_is_fl_resident !== false;
        }
        if (data.pr_relationship === undefined || data.pr_relationship === '') {
            data.pr_relationship = first.pr_relationship || '';
        }
    }

    // Pre-compute grammar strings so templates read clean instead of nesting
    // conditionals for every "Petitioner / Petitioners" / "alleges / allege" choice.
    const petCount = Array.isArray(data.petitioners) ? data.petitioners.filter(p => (p.pet_name || '').trim()).length : 0;
    const multiPet = petCount > 1;
    data.multiple_petitioners = multiPet;
    if (!data.petitioner_label) data.petitioner_label = multiPet ? 'Petitioners' : 'Petitioner';
    if (!data.petitioner_poss) data.petitioner_poss = multiPet ? 'petitioners\u2019' : 'petitioner\u2019s';
    if (!data.petitioner_verb_alleges) data.petitioner_verb_alleges = multiPet ? 'allege' : 'alleges';
    if (!data.petitioner_verb_has) data.petitioner_verb_has = multiPet ? 'have' : 'has';
    if (!data.petitioner_verb_is) data.petitioner_verb_is = multiPet ? 'are' : 'is';

    const prCount = Array.isArray(data.prs) ? data.prs.filter(p => (p.pr_name || '').trim()).length : 0;
    const multiPr = prCount > 1;
    data.multiple_prs = multiPr;
    if (!data.pr_label) data.pr_label = multiPr ? 'personal representatives' : 'personal representative';
    if (!data.pr_label_title) data.pr_label_title = multiPr ? 'Personal Representatives' : 'Personal Representative';
    if (!data.pr_label_caps) data.pr_label_caps = multiPr ? 'PERSONAL REPRESENTATIVES' : 'PERSONAL REPRESENTATIVE';
    if (!data.pr_verb_is) data.pr_verb_is = multiPr ? 'are' : 'is';
    if (!data.pr_pronoun_he_she) data.pr_pronoun_he_she = multiPr ? 'they' : 'he or she';
    if (!data.pr_pronoun_his_her) data.pr_pronoun_his_her = multiPr ? 'their' : 'his or her';

    // is_testate / is_ancillary live on matter.matterData; default gracefully
    if (data.is_testate === undefined || data.is_testate === null) data.is_testate = false;
    if (data.is_ancillary === undefined || data.is_ancillary === null) data.is_ancillary = false;

    // Caveat (P1-CAVEAT) derived flags. caveator_type select drives title +
    // body language; caveator_is_nonresident drives the "FL attorney" paragraph
    // and the attorney signature block.
    data.caveator_is_creditor = data.caveator_type === 'creditor';
    data.caveator_is_ip = data.caveator_type === 'interested_person';

    // Summary administration (P2-PETITION) derived flags. creditors_status
    // select drives which paragraph 10 sentence renders.
    data.creditors_all_barred = data.creditors_status === 'all_barred';
    data.creditors_no_debt = data.creditors_status === 'no_debt';
    data.creditors_has_debt = data.creditors_status === 'has_debt';

    // Proof of Service of Formal Notice (P1-PROOF-OF-SERVICE-FN) derived flags.
    // service_type select drives title + body language.
    data.service_type_certified = data.service_type === 'formal_notice_certified';
    data.service_type_first_class = data.service_type === 'formal_notice_first_class';
    data.service_type_in_manner_of = data.service_type === 'in_the_manner_of';

    // Guardianship smart-template presentation tokens. The Open Guardianship
    // wizard sets matter-level flags (is_minor / is_adult_incapacity /
    // is_plenary / is_limited / scope_*); these tokens collapse the dozens
    // of nested conditionals the body text would otherwise need into
    // single-token interpolations like {guardian_kind_caps}, {scope_phrase}.
    if (md.is_minor || md.is_adult_incapacity) {
        const isMinor = md.is_minor === true;
        const isPlenary = md.is_plenary === true;
        const isLimited = md.is_limited === true;
        const scope = md.scope_both ? 'both'
                    : md.is_scope_person_only ? 'person'
                    : md.is_scope_property_only ? 'property'
                    : (md.scope_property ? 'both' : (md.scope_person ? 'person' : ''));
        // ward / minor terminology
        data.ward_term = isMinor ? 'minor' : 'Ward';
        data.ward_term_lower = isMinor ? 'minor' : 'ward';
        // guardian-kind label (caps + lower)
        if (isMinor) {
            data.guardian_kind_caps = 'GUARDIAN OF MINOR';
            data.guardian_kind_lower = 'guardian';
        } else if (isPlenary) {
            data.guardian_kind_caps = 'PLENARY GUARDIAN';
            data.guardian_kind_lower = 'plenary guardian';
        } else if (isLimited) {
            data.guardian_kind_caps = 'LIMITED GUARDIAN';
            data.guardian_kind_lower = 'limited guardian';
        }
        // scope phrase used in body + closing
        const scopePhraseMap = {
            'person': 'of the person',
            'property': 'of the property',
            'both': 'of the person and property'
        };
        data.scope_phrase = scopePhraseMap[scope] || '';
        // subtitle under the title — varies on capacity track + scope
        const minorSubtitle = {
            'person':   '(Guardianship of Person)',
            'property': '(Guardianship of Property)',
            'both':     '(Guardianship of Person and Property)'
        };
        const incapSubtitle = {
            'person':   '(Incapacity - person)',
            'property': '(Incapacity - property)',
            'both':     '(Incapacity - person and property)'
        };
        data.scope_subtitle = isMinor ? (minorSubtitle[scope] || '') : (incapSubtitle[scope] || '');
        // alternatives-paragraph closing — plenary vs limited differ
        data.delegable_rights_phrase = isPlenary
            ? 'all delegable rights of the Ward'
            : (isLimited ? 'the delegable rights of the Ward identified above' : '');
        // limited-only "essential requirements" lead-in by scope
        const limitedAspects = {
            'person':   'physical health or safety',
            'property': 'management of the Ward’s financial resources',
            'both':     'physical health or safety and certain aspects of the management of the Ward’s financial resources'
        };
        data.limited_aspects_phrase = limitedAspects[scope] || '';
        // property-table lead-in — limited petitions say "approximate"; plenary doesn't.
        data.limited_property_lead = isLimited ? 'approximate ' : 'nature and ';
        // Order title second line (G3-ORDER) — "OF PERSON [AND PROPERTY] [OF MINOR]"
        const orderScopeMap = {
            'person': 'OF PERSON',
            'property': 'OF PROPERTY',
            'both': 'OF PERSON AND PROPERTY'
        };
        const baseOrderScope = orderScopeMap[scope] || '';
        data.order_scope_line = isMinor && baseOrderScope ? (baseOrderScope + ' OF MINOR') : baseOrderScope;
        // Letters second line — same shape, used by G3-LETTERS
        data.letters_scope_line = data.order_scope_line;
        // Order subtitle parenthetical (G3-ORDER) — minor has none.
        if (isMinor) {
            data.order_subtitle = '';
        } else if (isPlenary) {
            data.order_subtitle = data.has_advance_directive
                ? '(Total incapacity – advance directive)'
                : '(Total incapacity – no known advance directive)';
        } else if (isLimited) {
            data.order_subtitle = '(Limited incapacity – no known advance directive)';
        } else {
            data.order_subtitle = '';
        }
        // Letters title (G3-LETTERS) — "GUARDIANSHIP" suffix variant.
        if (isMinor) {
            data.letters_kind_caps = 'GUARDIANSHIP OF MINOR';
        } else if (isPlenary) {
            data.letters_kind_caps = 'PLENARY GUARDIANSHIP';
        } else if (isLimited) {
            data.letters_kind_caps = 'LIMITED GUARDIANSHIP';
        } else {
            data.letters_kind_caps = 'GUARDIANSHIP';
        }
    }

    // Proof of Will (P3-PROOF-WILL) derived flags. Two selects drive body
    // language for unavailable-witness reason + affiant's relation to estate.
    data.witness_unavailable_cannot_be_found = data.witness_unavailable_reason === 'cannot_be_found';
    data.witness_unavailable_incapacitated = data.witness_unavailable_reason === 'incapacitated';
    data.witness_unavailable_unavailable = data.witness_unavailable_reason === 'unavailable';
    data.affiant_is_pr_nominated = data.affiant_relation === 'is_pr_nominated';
    data.affiant_has_no_interest = data.affiant_relation === 'no_interest';

    // ISO "YYYY-MM-DD" → "Month D, YYYY" for every field declared type=date.
    // Applies to top-level and repeating-group subfields across all selected
    // forms. Legacy free-text dates pass through unchanged.
    const dateNames = collectDateFieldNames();
    dateNames.topLevel.forEach(name => {
        data[name] = formatDateFieldValue(data[name]);
    });
    dateNames.subfields.forEach((subfieldSet, parentName) => {
        if (Array.isArray(data[parentName])) {
            data[parentName] = data[parentName].map(row => {
                const out = { ...row };
                subfieldSet.forEach(sf => {
                    out[sf] = formatDateFieldValue(out[sf]);
                });
                return out;
            });
        }
    });

    // Structured address object → single-line prose for templates. Falls back
    // to legacy free-text strings unchanged. Applied AFTER the sibling-form
    // merge so older plain-string addresses on other forms still work.
    const addressNames = collectAddressFieldNames();
    addressNames.topLevel.forEach(name => {
        data[name] = formatAddressValue(data[name]);
    });
    addressNames.subfields.forEach((subfieldSet, parentName) => {
        if (Array.isArray(data[parentName])) {
            data[parentName] = data[parentName].map(row => {
                const out = { ...row };
                subfieldSet.forEach(sf => {
                    out[sf] = formatAddressValue(out[sf]);
                });
                return out;
            });
        }
    });

    // Currency formatting for estate asset rows. Values enter as Numbers; the
    // template gets {asset_value_formatted} (e.g. "$1,500.00") for display
    // while the raw Number stays on asset_value for later math.
    if (Array.isArray(data.estate_assets)) {
        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        let total = 0;
        data.estate_assets = data.estate_assets.map(row => {
            const v = typeof row.asset_value === 'number' ? row.asset_value : Number(row.asset_value);
            const valid = Number.isFinite(v);
            if (valid) total += v;
            return { ...row, asset_value_formatted: valid ? fmt.format(v) : '' };
        });
        data.estate_assets_total = total;
        data.estate_assets_total_formatted = fmt.format(total);
    }

    return data;
}

function makeDocFileName(subjectName, form, dateStr) {
    // Use the form's human-readable name instead of the ID
    // e.g. "Lorraine_Ann_Muscara_Petition_for_Administration_2026-04-15.docx"
    const formName = (form.name || form.id).replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
    const ext = form.delivery === 'pdf_passthrough' ? '.pdf' : '.docx';
    return subjectName + '_' + formName + '_' + dateStr + ext;
}

// ============================================
// CLAUDE IMPORT
// ============================================

function setupClaudeImport() {
    document.getElementById('claudeImportBtn').addEventListener('click', openClaudeImportModal);
    document.getElementById('importPreviewBtn').addEventListener('click', previewClaudeImport);
    document.getElementById('importConfirmBtn').addEventListener('click', confirmClaudeImport);

    // Auto-preview on paste
    document.getElementById('claudeImportData').addEventListener('paste', () => {
        setTimeout(previewClaudeImport, 100);
    });
}

function openClaudeImportModal() {
    document.getElementById('claudeImportData').value = '';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importError').style.display = 'none';
    document.getElementById('importConfirmBtn').disabled = true;
    document.getElementById('claudeImportModal').style.display = 'flex';
    document.getElementById('claudeImportData').focus();
}

let pendingImportData = null;

function previewClaudeImport() {
    const raw = document.getElementById('claudeImportData').value.trim();
    const previewEl = document.getElementById('importPreview');
    const errorEl = document.getElementById('importError');
    const confirmBtn = document.getElementById('importConfirmBtn');

    previewEl.style.display = 'none';
    errorEl.style.display = 'none';
    confirmBtn.disabled = true;
    pendingImportData = null;

    if (!raw) return;

    try {
        const data = JSON.parse(raw);

        // Validate required structure
        if (!data.client || !data.matter) {
            throw new Error('JSON must have "client" and "matter" objects');
        }
        if (!data.client.lastName) {
            throw new Error('client.lastName is required');
        }
        if (!data.matter.subjectName) {
            throw new Error('matter.subjectName is required');
        }
        if (!data.matter.type) {
            data.matter.type = 'probate'; // default
        }

        // Check for existing client match
        const existingClient = findMatchingClient(data.client);
        const existingMatter = existingClient ? findMatchingMatter(existingClient, data.matter) : null;

        // Count form fields
        const fieldCount = data.formData ? Object.keys(data.formData).length : 0;
        const arrayFields = data.formData ? Object.values(data.formData).filter(v => Array.isArray(v)) : [];
        const arrayDesc = arrayFields.length > 0
            ? ' + ' + arrayFields.map(a => a.length + ' rows').join(', ')
            : '';

        // Build preview
        const clientName = (data.client.firstName || '') + ' ' + data.client.lastName;
        const matterLabel = data.matter.type === 'probate'
            ? 'Probate — Estate of ' + data.matter.subjectName
            : 'Guardianship — ' + data.matter.subjectName;

        let html = '<h4>Import Preview</h4>';
        html += '<div class="preview-field"><span class="preview-label">Client:</span> ' + escapeHtml(clientName.trim());
        if (existingClient) {
            html += ' <em>(existing — will update)</em>';
        } else {
            html += ' <em>(new client)</em>';
        }
        html += '</div>';
        html += '<div class="preview-field"><span class="preview-label">Matter:</span> ' + escapeHtml(matterLabel);
        if (existingMatter) {
            html += ' <em>(existing — will merge data)</em>';
        } else {
            html += ' <em>(new matter)</em>';
        }
        html += '</div>';
        if (data.matter.fileNo) {
            html += '<div class="preview-field"><span class="preview-label">File No.:</span> ' + escapeHtml(data.matter.fileNo) + '</div>';
        }
        if (data.matter.county) {
            html += '<div class="preview-field"><span class="preview-label">County:</span> ' + escapeHtml(data.matter.county) + '</div>';
        }
        html += '<div class="preview-field"><span class="preview-label">Form fields:</span> ' + fieldCount + ' fields' + arrayDesc + '</div>';

        previewEl.innerHTML = html;
        previewEl.style.display = 'block';
        confirmBtn.disabled = false;
        pendingImportData = data;
    } catch (e) {
        errorEl.textContent = 'Invalid JSON: ' + e.message;
        errorEl.style.display = 'block';
    }
}

function findMatchingClient(importClient) {
    const lastName = (importClient.lastName || '').toLowerCase().trim();
    const firstName = (importClient.firstName || '').toLowerCase().trim();
    return clients.find(c => {
        const cLast = (c.lastName || '').toLowerCase().trim();
        const cFirst = (c.firstName || '').toLowerCase().trim();
        return cLast === lastName && (cFirst === firstName || !firstName || !cFirst);
    });
}

function findMatchingMatter(client, importMatter) {
    const subjectName = (importMatter.subjectName || '').toLowerCase().trim();
    return (client.matters || []).find(m => {
        return (m.subjectName || '').toLowerCase().trim() === subjectName;
    });
}

function confirmClaudeImport() {
    if (!pendingImportData) return;

    const data = pendingImportData;

    // Find or create client
    let client = findMatchingClient(data.client);
    if (client) {
        // Update existing client with any new info
        if (data.client.firstName) client.firstName = data.client.firstName;
        if (data.client.address) client.address = data.client.address;
        if (data.client.phone) client.phone = data.client.phone;
        if (data.client.email) client.email = data.client.email;
    } else {
        client = {
            id: generateId(),
            firstName: data.client.firstName || '',
            lastName: data.client.lastName,
            address: data.client.address || '',
            phone: data.client.phone || '',
            email: data.client.email || '',
            matters: [],
            createdAt: new Date().toISOString(),
            createdBy: window.currentUser ? window.currentUser.id : null
        };
        clients.unshift(client);
    }

    // Find or create matter
    let matter = findMatchingMatter(client, data.matter);
    if (matter) {
        // Update existing matter metadata
        if (data.matter.fileNo) matter.fileNo = data.matter.fileNo;
        if (data.matter.county) matter.county = data.matter.county;
        if (data.matter.division) matter.division = data.matter.division;
        if (data.matter.matterData) {
            matter.matterData = { ...(matter.matterData || {}), ...data.matter.matterData };
        }
    } else {
        matter = {
            id: generateId(),
            type: data.matter.type || 'probate',
            subjectName: data.matter.subjectName,
            county: data.matter.county || '',
            fileNo: data.matter.fileNo || '',
            division: data.matter.division || '',
            createdBy: window.currentUser ? window.currentUser.id : null,
            matterData: data.matter.matterData || {},
            formData: {},
            createdAt: new Date().toISOString()
        };
        if (!client.matters) client.matters = [];
        client.matters.push(matter);
    }

    // Merge form data — import data wins over existing empty values
    if (data.formData && Object.keys(data.formData).length > 0) {
        if (!matter.formData) matter.formData = {};

        // Store as a shared data pool under a special '_claude_import' key
        // AND merge into any existing form-specific data
        const existing = matter.formData['_shared'] || {};
        matter.formData['_shared'] = { ...existing, ...data.formData };

        // Also merge into any existing per-form data
        Object.keys(matter.formData).forEach(formId => {
            if (formId === '_shared') return;
            const formFields = matter.formData[formId];
            Object.keys(data.formData).forEach(key => {
                // Only fill in if the existing value is empty/missing
                if (!formFields[key] && formFields[key] !== false && data.formData[key]) {
                    formFields[key] = data.formData[key];
                }
            });
        });
    }

    // Infer wizard selections from import data if not already set
    if (!matter.wizardSelections && matter.type === 'probate') {
        const fd = data.formData || {};
        const md = data.matter.matterData || {};

        // Allow explicit wizardSelections in the import JSON
        if (data.wizardSelections) {
            matter.wizardSelections = data.wizardSelections;
        } else {
            // Infer from data
            const hasWill = !!(fd.will_date || fd.will_year || fd.codicil_dates);
            const petArr = fd.petitioners;
            const hasMutiplePetitioners = Array.isArray(petArr) && petArr.length > 1;

            matter.wizardSelections = {
                adminType: 'formal',       // default to formal; summary is rarer
                willType: hasWill ? 'testate' : 'intestate',
                jurisdiction: 'domiciliary', // default; ancillary is rarer
                petitioners: hasMutiplePetitioners ? 'multiple' : 'single',
                county: matter.county || null
            };
        }
    }

    saveClientsToStorage();

    // Navigate to the imported client/matter
    currentClient = client;
    currentMatter = matter;
    currentFormId = null;
    selectedFormIds = [];
    currentFormData = {};

    renderClientList();
    renderMatterView();
    showView('matter');
    closeAllModals();

    const fieldCount = data.formData ? Object.keys(data.formData).length : 0;
    showNotification('Imported: ' + (data.matter.subjectName || 'matter') + ' (' + fieldCount + ' fields)', 'success');

    pendingImportData = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// MODALS
// ============================================

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    editingClientId = null;
    editingMatterId = null;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading(show = true) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showNotification(message, type) {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = 'notification ' + (type || 'info');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// ============================================
// START APP
// ============================================

document.addEventListener('DOMContentLoaded', initializeApp);
