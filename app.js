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
            formIds: ['P3-0100', 'P3-0420', 'P3-0600', 'P3-0700', 'P1-0900', 'BW-0010', 'BW-0020']
        },
        {
            name: 'Open Estate (intestate)',
            formIds: ['P3-0120', 'P3-0440', 'P3-0600', 'P3-0700', 'P1-0900', 'BW-0010']
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
            formIds: ['P2-0204', 'P2-0300', 'P2-0355']
        },
        {
            name: 'Summary Admin (intestate)',
            formIds: ['P2-0214', 'P2-0310', 'P2-0355']
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
            },
            closing: {
                label: 'Additional Orders',
                subtitle: 'Will admission orders (if not included in opening)',
                formIds: ['P2-0500', 'P2-0600', 'P2-0610', 'P2-0630', 'P2-0650']
            }
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
                        decedent_address: '1200 SW 3rd St, Apt 204, Fort Lauderdale, FL 33312',
                        decedent_death_date: 'March 2',
                        decedent_death_year: '2026',
                        decedent_death_place: 'Fort Lauderdale, FL',
                        decedent_domicile: 'Broward',
                        decedent_ssn_last4: '4829'
                    },
                    formData: {
                        'P3-0100': {
                            petitioner_name: 'Margaret Torres',
                            petitioner_interest: 'surviving daughter and sole beneficiary under the will',
                            petitioner_address: '4521 NE 12th Ave, Fort Lauderdale, FL 33334',
                            decedent_full_name: 'Helen Marie Torres',
                            decedent_address: '1200 SW 3rd St, Apt 204, Fort Lauderdale, FL 33312',
                            decedent_ssn_last4: '4829',
                            decedent_death_date: 'March 2',
                            decedent_death_year: '2026',
                            decedent_death_place: 'Fort Lauderdale, Broward County, Florida',
                            decedent_domicile: 'Broward',
                            venue_reason: 'the decedent was domiciled in Broward County, Florida at the time of death',
                            will_date: 'June 15',
                            will_year: '2019',
                            codicil_dates: '',
                            pr_name: 'Margaret Torres',
                            pr_address: '4521 NE 12th Ave, Fort Lauderdale, FL 33334',
                            pr_relationship: '',
                            domiciliary_court_address: '',
                            domiciliary_representative: '',
                            domiciliary_representative_address: '',
                            signing_day: '',
                            signing_month: '',
                            signing_year: '',
                            attorney_email: 'david@ginsbergshulman.com',
                            attorney_bar_no: '150762',
                            attorney_phone: '954-990-0896',
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

    // Open Estate Wizard
    setupWizard();

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
    if (currentClient.address) parts.push(currentClient.address.replace(/\n/g, '<br>'));
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
    document.getElementById('clientAddress').value = client ? client.address || '' : '';
    document.getElementById('clientPhone').value = client ? client.phone || '' : '';
    document.getElementById('clientEmail').value = client ? client.email || '' : '';
    document.getElementById('newClientModal').style.display = 'flex';
}

function handleClientFormSubmit(e) {
    e.preventDefault();
    const data = {
        firstName: document.getElementById('clientFirstName').value,
        lastName: document.getElementById('clientLastName').value,
        address: document.getElementById('clientAddress').value,
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
    document.getElementById('matterFileNo').value = matter ? matter.fileNo || '' : '';
    document.getElementById('matterDivision').value = matter ? matter.division || '' : '';
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

    const data = {
        type: document.getElementById('matterType').value,
        county: document.getElementById('matterCounty').value,
        subjectName: document.getElementById('matterSubjectName').value,
        fileNo: document.getElementById('matterFileNo').value,
        division: document.getElementById('matterDivision').value,
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
    // Formal Administration — Domiciliary
    'formal|testate|domiciliary|single': {
        forms: ['P3-0100', 'P3-0420', 'P3-0600', 'P3-0700', 'P1-0900'],
        broward: ['BW-0010', 'BW-0020']
    },
    'formal|intestate|domiciliary|single': {
        forms: ['P3-0120', 'P3-0440', 'P3-0600', 'P3-0700', 'P1-0900'],
        broward: ['BW-0010', 'BW-0030', 'BW-0060']
    },
    // Formal Admin — multiple petitioners (use same forms, multi-petitioner is rare in formal)
    'formal|testate|domiciliary|multiple': {
        forms: ['P3-0100', 'P3-0420', 'P3-0600', 'P3-0700', 'P1-0900'],
        broward: ['BW-0010', 'BW-0020']
    },
    'formal|intestate|domiciliary|multiple': {
        forms: ['P3-0120', 'P3-0440', 'P3-0600', 'P3-0700', 'P1-0900'],
        broward: ['BW-0010', 'BW-0030', 'BW-0060']
    },

    // Summary Administration — Domiciliary
    'summary|testate|domiciliary|single': {
        forms: ['P2-0204', 'P2-0300', 'P2-0355'],
        broward: ['BW-0010', 'BW-0040']
    },
    'summary|testate|domiciliary|multiple': {
        forms: ['P2-0205', 'P2-0300', 'P2-0355'],
        broward: ['BW-0010', 'BW-0040']
    },
    'summary|intestate|domiciliary|single': {
        forms: ['P2-0214', 'P2-0310', 'P2-0355'],
        broward: ['BW-0010', 'BW-0050', 'BW-0060']
    },
    'summary|intestate|domiciliary|multiple': {
        forms: ['P2-0215', 'P2-0310', 'P2-0355'],
        broward: ['BW-0010', 'BW-0050', 'BW-0060']
    },

    // Summary Administration — Ancillary
    'summary|testate|ancillary|single': {
        forms: ['P2-0219', 'P2-0320'],
        broward: ['BW-0010']
    },
    'summary|testate|ancillary|multiple': {
        forms: ['P2-0220', 'P2-0320'],
        broward: ['BW-0010']
    },
    'summary|intestate|ancillary|single': {
        forms: ['P2-0224', 'P2-0325'],
        broward: ['BW-0010']
    },
    'summary|intestate|ancillary|multiple': {
        forms: ['P2-0225', 'P2-0325'],
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
    // Show/hide petitioners question (only relevant for summary)
    const petGroup = document.getElementById('wizPetitionerGroup');
    if (wizardState.adminType === 'formal') {
        petGroup.style.opacity = '0.4';
        // Default to single for formal
        if (!wizardState.petitioners) {
            wizardState.petitioners = 'single';
            document.querySelector('#wizPetitioners .wiz-btn[data-value="single"]').classList.add('active');
        }
    } else {
        petGroup.style.opacity = '1';
    }

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

    // Only show wizard for probate matters
    const wizardEl = document.getElementById('openEstateWizard');
    if (wizardEl) {
        wizardEl.style.display = (currentMatter && currentMatter.type === 'probate') ? '' : 'none';
    }

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

    // --- Layer 3b: Auto-derive fields ---
    if (!defaults.affiant_name) defaults.affiant_name = defaults.petitioner_name || fullName;
    if (!defaults.notary_state) defaults.notary_state = 'Florida';
    if (!defaults.notary_county) defaults.notary_county = currentMatter.county || '';

    // --- Layer 4: Attorney defaults (per-matter attorneyId, falls back to type) ---
    const attorneyDefaults = getAttorneyDefaults(currentMatter);
    Object.keys(attorneyDefaults).forEach(key => {
        if (!defaults[key]) defaults[key] = attorneyDefaults[key];
    });

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

        form.sections.forEach(section => {
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
                        fields: [...newFields]
                    });
                }
            }
        });
    });

    // Render the merged sections
    mergedSections.forEach(section => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'form-section';

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
}

function renderFormField(field) {
    const container = document.createElement('div');
    container.className = 'form-field-container';

    if (field.type === 'text') {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        const label = document.createElement('label');
        label.htmlFor = 'form_' + field.name;
        label.textContent = field.label;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'form_' + field.name;
        input.className = 'form-field-input';
        input.dataset.field = field.name;
        input.value = currentFormData[field.name] || '';
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
    } else if (field.type === 'checkbox') {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'checkbox-item';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'form_' + field.name;
        input.className = 'form-field-input';
        input.dataset.field = field.name;
        input.checked = currentFormData[field.name] === true;
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

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'repeating-group-items';
        itemsContainer.id = 'group_' + field.name;

        const items = currentFormData[field.name] || [];
        items.forEach((item, index) => {
            itemsContainer.appendChild(renderRepeatingGroupItem(field, item, index));
        });
        groupDiv.appendChild(itemsContainer);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'add-row-btn';
        addBtn.textContent = '+ Add Row';
        addBtn.dataset.field = field.name;
        groupDiv.appendChild(addBtn);
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
        const label = document.createElement('label');
        label.textContent = subfield.label;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-field-input';
        input.dataset.field = field.name;
        input.dataset.subfield = subfield.name;
        input.dataset.index = index;
        input.value = item[subfield.name] || '';
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(input);
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

function addRepeatingGroupRow(fieldName) {
    if (!currentFormData[fieldName]) currentFormData[fieldName] = [];

    const form = formsConfig.forms.find(f => f.id === currentFormId);
    const field = form.sections.flatMap(s => s.fields).find(f => f.name === fieldName);
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

    document.querySelectorAll('#formFieldsContainer .form-field-input').forEach(input => {
        if (!input.dataset.index) {
            const field = input.dataset.field;
            if (input.type === 'checkbox') {
                formData[field] = input.checked;
            } else {
                formData[field] = input.value;
            }
        }
    });

    document.querySelectorAll('#formFieldsContainer .repeating-group-item-field input').forEach(input => {
        const field = input.dataset.field;
        const subfield = input.dataset.subfield;
        const index = parseInt(input.dataset.index, 10);
        if (!formData[field]) formData[field] = [];
        if (!formData[field][index]) formData[field][index] = {};
        formData[field][index][subfield] = input.value;
    });

    currentFormData = formData;
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

function prepareTemplateData() {
    const data = {};

    // Matter-level fields (auto-populate into templates)
    data.county = currentMatter.county || '';
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
    data.petitioner_address = currentClient.address || '';

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

    // Derive petitioner_names from petitioners array for backward compatibility
    if (data.petitioners && Array.isArray(data.petitioners)) {
        if (!data.petitioner_names) {
            data.petitioner_names = data.petitioners.map(p => p.pet_name).filter(Boolean).join(' and ');
        }
    }

    return data;
}

function makeDocFileName(subjectName, form, dateStr) {
    // Use the form's human-readable name instead of the ID
    // e.g. "Lorraine_Ann_Muscara_Petition_for_Administration_2026-04-15.docx"
    const formName = (form.name || form.id).replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
    return subjectName + '_' + formName + '_' + dateStr + '.docx';
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
