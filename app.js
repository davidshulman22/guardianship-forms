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

// ============================================
// INITIALIZATION
// ============================================

async function initializeApp() {
    await loadFormsConfig();
    loadClientsFromStorage();
    renderClientList();
    setupEventListeners();
    showView('noClient');
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
// LOCAL STORAGE
// ============================================

function loadClientsFromStorage() {
    const saved = localStorage.getItem('gs_court_forms_clients');
    const seedVersion = '3'; // bump this to force reseed
    if (saved && localStorage.getItem('gs_seed_version') === seedVersion) {
        clients = JSON.parse(saved);
    } else {
        // First run or seed version changed — reseed
        localStorage.removeItem('gs_court_forms_clients');
        clients = [];
    }
    if (clients.length === 0) {
        seedTestData();
        localStorage.setItem('gs_seed_version', seedVersion);
    }
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
        }
    ];
    saveClientsToStorage();
}

function saveClientsToStorage() {
    localStorage.setItem('gs_court_forms_clients', JSON.stringify(clients));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================
// VIEW MANAGEMENT
// ============================================

function showView(view) {
    document.getElementById('viewNoClient').style.display = 'none';
    document.getElementById('viewClient').style.display = 'none';
    document.getElementById('viewMatter').style.display = 'none';

    if (view === 'noClient') {
        document.getElementById('viewNoClient').style.display = 'flex';
        document.getElementById('breadcrumb').textContent = '';
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

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
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
        div.innerHTML = `
            <div class="client-item-name">${client.lastName || ''}, ${client.firstName || ''}</div>
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
            createdAt: new Date().toISOString()
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
            createdAt: new Date().toISOString()
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
    // Reset wizard state
    wizardState = {
        adminType: null,
        willType: null,
        jurisdiction: null,
        petitioners: null,
        county: currentMatter ? currentMatter.county || null : null
    };

    // Reset toggle buttons
    ['wizAdminType', 'wizWillType', 'wizJurisdiction', 'wizPetitioners'].forEach(groupId => {
        const group = document.getElementById(groupId);
        if (group) group.querySelectorAll('.wiz-btn').forEach(b => b.classList.remove('active'));
    });

    // Set county from matter
    const countySelect = document.getElementById('wizCounty');
    if (countySelect && currentMatter) {
        // Try to match the matter county to an option
        const county = currentMatter.county || '';
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
    handleFormSelectionChanged();
}

function syncCheckboxes() {
    document.querySelectorAll('#formChecklist input[type="checkbox"]').forEach(cb => {
        cb.checked = selectedFormIds.includes(cb.value);
    });
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

function getAutoPopulateDefaults() {
    /**
     * Build a map of field defaults from three sources (in priority order):
     * 1. Data entered in OTHER forms for this matter (cross-form sharing)
     * 2. Matter-level data (county, subject name, matterData)
     * 3. Client-level data (petitioner name/address)
     * 4. Attorney defaults
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

    // --- Layer 4: Attorney defaults ---
    if (!defaults.attorney_name) defaults.attorney_name = 'David A. Shulman';
    if (!defaults.attorney_email) defaults.attorney_email = 'david@ginsbergshulman.com';
    if (!defaults.attorney_email_secondary) defaults.attorney_email_secondary = '';
    if (!defaults.attorney_bar_no) defaults.attorney_bar_no = '150762';
    if (!defaults.attorney_address) defaults.attorney_address = 'Ginsberg Shulman PL\n300 SE 2nd St Ste 600\nFort Lauderdale, FL 33301';
    if (!defaults.attorney_phone) defaults.attorney_phone = '954-990-0896';

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
            const fileName = subjectName + '_' + form.id + '_' + dateStr + '.docx';
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
                const fileName = subjectName + '_' + form.id + '_' + dateStr + '.docx';
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
    data.file_no = currentMatter.fileNo || '';
    data.division = currentMatter.division || '';

    // Client-level fields
    data.petitioner_name = (currentClient.firstName || '') + ' ' + (currentClient.lastName || '');
    data.petitioner_address = currentClient.address || '';

    // Attorney defaults
    data.attorney_name = 'David A. Shulman';
    data.attorney_email = 'david@ginsbergshulman.com';
    data.attorney_bar_no = '150762';
    data.attorney_address = 'Ginsberg Shulman PL\n300 SE 2nd St Ste 600\nFort Lauderdale, FL 33301';
    data.attorney_phone = '954-990-0896';

    // Form-specific fields
    Object.keys(currentFormData).forEach(key => {
        const value = currentFormData[key];
        if (typeof value === 'boolean') {
            data[key] = value ? '(X)' : '(  )';
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
