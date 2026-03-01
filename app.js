// ============================================
// INITIALIZATION & CONFIGURATION
// ============================================

const SUPABASE_URL = 'https://xcjrpfkexdxggkaswefh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_j16AIqi-9mDFWyWFxMZCAQ_geY3ks09';

let db;
let currentUser = null;
let currentClient = null;
let formsConfig = null;
let currentFormId = null;
let currentFormData = {};

// Debounce timers
let coreFieldsSaveTimer = null;
let formFieldsSaveTimer = null;

// ============================================
// INITIALIZATION
// ============================================

async function initializeApp() {
    // Initialize Supabase
    const { createClient } = window.supabase;
    db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Load forms config
    await loadFormsConfig();

    // Check if user is logged in
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        showMainApp();
    } else {
        showLoginScreen();
    }

    // Listen for auth changes
    db.auth.onAuthStateChange((event, session) => {
        if (session) {
            currentUser = session.user;
            showMainApp();
        } else {
            currentUser = null;
            showLoginScreen();
        }
    });

    setupEventListeners();
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
// UI STATE MANAGEMENT
// ============================================

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('userEmail').textContent = currentUser.email;
    loadClients();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // New client
    document.getElementById('newClientBtn').addEventListener('click', openNewClientModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeNewClientModal);
    document.getElementById('cancelNewClientBtn').addEventListener('click', closeNewClientModal);
    document.getElementById('newClientForm').addEventListener('submit', handleNewClientSubmit);

    // Client search
    document.getElementById('clientSearch').addEventListener('input', debounce(filterClients, 300));

    // Core fields - auto-save
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('core-field')) {
            clearTimeout(coreFieldsSaveTimer);
            coreFieldsSaveTimer = setTimeout(saveCoreFields, 800);
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('core-field')) {
            clearTimeout(coreFieldsSaveTimer);
            coreFieldsSaveTimer = setTimeout(saveCoreFields, 800);
        }
    });

    // Form selector
    document.getElementById('formSelect').addEventListener('change', handleFormSelect);

    // Form-specific fields - auto-save
    document.addEventListener('change', (e) => {
        if (e.target.closest('#formFieldsSection') && !e.target.classList.contains('form-field-temp')) {
            clearTimeout(formFieldsSaveTimer);
            formFieldsSaveTimer = setTimeout(saveFormFields, 800);
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.closest('#formFieldsSection') && !e.target.classList.contains('form-field-temp')) {
            clearTimeout(formFieldsSaveTimer);
            formFieldsSaveTimer = setTimeout(saveFormFields, 800);
        }
    });

    // Document generation
    document.getElementById('generateDocBtn').addEventListener('click', generateDocument);

    // Modal backdrop click
    document.getElementById('newClientModal').addEventListener('click', (e) => {
        if (e.target.id === 'newClientModal') {
            closeNewClientModal();
        }
    });

    // Add/remove repeating group rows
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-row-btn')) {
            const fieldName = e.target.dataset.field;
            addRepeatingGroupRow(fieldName);
        }
        if (e.target.classList.contains('remove-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            const fieldName = e.target.dataset.field;
            removeRepeatingGroupRow(fieldName, index);
        }
    });
}

// ============================================
// LOGIN & AUTHENTICATION
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    errorDiv.textContent = '';

    showLoading();
    try {
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            errorDiv.textContent = error.message || 'Login failed';
            showLoading(false);
            return;
        }

        document.getElementById('loginForm').reset();
        showLoading(false);
    } catch (error) {
        errorDiv.textContent = 'An error occurred during login';
        showLoading(false);
    }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        showLoading();
        await db.auth.signOut();
        currentClient = null;
        currentFormId = null;
        showLoading(false);
    }
}

// ============================================
// CLIENT MANAGEMENT
// ============================================

async function loadClients() {
    try {
        showLoading();
        const { data, error } = await db
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const clientList = document.getElementById('clientList');
        clientList.innerHTML = '';

        if (data && data.length > 0) {
            data.forEach(client => {
                const item = createClientListItem(client);
                clientList.appendChild(item);
            });
        } else {
            clientList.innerHTML = '<p style="padding: 1rem; color: #999; text-align: center;">No clients yet</p>';
        }

        showLoading(false);
    } catch (error) {
        console.error('Error loading clients:', error);
        showNotification('Failed to load clients', 'error');
        showLoading(false);
    }
}

function createClientListItem(client) {
    const div = document.createElement('div');
    div.className = 'client-item';
    div.innerHTML = `
        <div class="client-item-name">${client.aip_name || 'Unnamed'}</div>
        <div class="client-item-info">${client.file_no || 'No file'}</div>
    `;
    div.addEventListener('click', (e) => selectClient(client, e.currentTarget));
    return div;
}

function selectClient(client, element) {
    // Deselect previous client
    document.querySelectorAll('.client-item').forEach(item => {
        item.classList.remove('active');
    });

    // Select new client
    element.classList.add('active');

    currentClient = client;
    currentFormId = null;
    currentFormData = {};

    // Show client panel, hide placeholder
    document.getElementById('noClientSelected').style.display = 'none';
    document.getElementById('clientPanel').style.display = 'block';

    populateCoreFields(client);
    showFormSelector();
    resetFormFields();
}

function populateCoreFields(client) {
    const coreFields = [
        'county', 'file_no', 'division',
        'petitioner_name', 'petitioner_age', 'petitioner_address', 'petitioner_relationship',
        'aip_name', 'aip_age', 'aip_county', 'aip_primary_language', 'aip_address',
        'attorney_name', 'attorney_email', 'attorney_bar_no', 'attorney_address', 'attorney_phone',
        'physician_name', 'physician_address', 'physician_phone'
    ];

    coreFields.forEach(field => {
        const input = document.getElementById(`field_${field}`);
        if (input) {
            input.value = client[field] || '';
        }
    });
}

function filterClients() {
    const query = document.getElementById('clientSearch').value.toLowerCase();
    const items = document.querySelectorAll('.client-item');

    items.forEach(item => {
        const name = item.querySelector('.client-item-name').textContent.toLowerCase();
        const info = item.querySelector('.client-item-info').textContent.toLowerCase();
        const matches = name.includes(query) || info.includes(query);
        item.style.display = matches ? '' : 'none';
    });
}

// ============================================
// NEW CLIENT MODAL
// ============================================

function openNewClientModal() {
    document.getElementById('newClientModal').style.display = 'flex';
}

function closeNewClientModal() {
    document.getElementById('newClientModal').style.display = 'none';
    document.getElementById('newClientForm').reset();
}

async function handleNewClientSubmit(e) {
    e.preventDefault();

    const clientData = {
        county: document.getElementById('newCounty').value,
        file_no: document.getElementById('newFileNo').value,
        division: document.getElementById('newDivision').value,
        petitioner_name: document.getElementById('newPetitionerName').value,
        petitioner_age: document.getElementById('newPetitionerAge').value,
        petitioner_relationship: document.getElementById('newPetitionerRelationship').value,
        petitioner_address: document.getElementById('newPetitionerAddress').value,
        aip_name: document.getElementById('newAIPName').value,
        aip_age: document.getElementById('newAIPAge').value,
        aip_county: document.getElementById('newAIPCounty').value,
        aip_primary_language: document.getElementById('newAIPLanguage').value,
        aip_address: document.getElementById('newAIPAddress').value,
        attorney_name: document.getElementById('newAttorneyName').value,
        attorney_bar_no: document.getElementById('newAttorneyBarNo').value,
        attorney_email: document.getElementById('newAttorneyEmail').value,
        attorney_phone: document.getElementById('newAttorneyPhone').value,
        attorney_address: document.getElementById('newAttorneyAddress').value,
        physician_name: document.getElementById('newPhysicianName').value,
        physician_phone: document.getElementById('newPhysicianPhone').value,
        physician_address: document.getElementById('newPhysicianAddress').value
    };

    showLoading();
    try {
        const { data, error } = await db
            .from('clients')
            .insert([{ ...clientData, created_by: currentUser.id }])
            .select();

        if (error) throw error;

        closeNewClientModal();
        loadClients();
        showNotification('Client created successfully', 'success');
        showLoading(false);
    } catch (error) {
        console.error('Error creating client:', error);
        showNotification('Failed to create client', 'error');
        showLoading(false);
    }
}

// ============================================
// CORE FIELDS MANAGEMENT
// ============================================

async function saveCoreFields() {
    if (!currentClient) return;

    const coreFields = [
        'county', 'file_no', 'division',
        'petitioner_name', 'petitioner_age', 'petitioner_address', 'petitioner_relationship',
        'aip_name', 'aip_age', 'aip_county', 'aip_primary_language', 'aip_address',
        'attorney_name', 'attorney_email', 'attorney_bar_no', 'attorney_address', 'attorney_phone',
        'physician_name', 'physician_address', 'physician_phone'
    ];

    const updates = {};
    coreFields.forEach(field => {
        const input = document.getElementById(`field_${field}`);
        if (input) {
            updates[field] = input.value;
        }
    });

    try {
        const { error } = await db
            .from('clients')
            .update(updates)
            .eq('id', currentClient.id);

        if (error) throw error;
        currentClient = { ...currentClient, ...updates };
    } catch (error) {
        console.error('Error saving core fields:', error);
        showNotification('Failed to save changes', 'error');
    }
}

// ============================================
// FORM SELECTOR & RENDERING
// ============================================

function showFormSelector() {
    document.getElementById('formSelectorSection').style.display = 'block';
    const select = document.getElementById('formSelect');
    select.innerHTML = '<option value="">-- Choose a form --</option>';

    if (formsConfig && formsConfig.forms) {
        formsConfig.forms.forEach(form => {
            const option = document.createElement('option');
            option.value = form.id;
            option.textContent = form.name;
            select.appendChild(option);
        });
    }
}

async function handleFormSelect(e) {
    const formId = e.target.value;
    if (!formId) {
        resetFormFields();
        return;
    }

    currentFormId = formId;
    await loadFormData(formId);
    renderFormFields();
}

async function loadFormData(formId) {
    if (!currentClient) return;

    try {
        const { data, error } = await db
            .from('form_submissions')
            .select('form_data')
            .eq('client_id', currentClient.id)
            .eq('form_id', formId)
            .single();

        if (data) {
            currentFormData = data.form_data || {};
        } else {
            currentFormData = {};
        }
    } catch (error) {
        // No existing submission, start fresh
        currentFormData = {};
    }
}

function renderFormFields() {
    if (!currentFormId || !formsConfig) {
        resetFormFields();
        return;
    }

    const form = formsConfig.forms.find(f => f.id === currentFormId);
    if (!form) return;

    const container = document.getElementById('formFieldsContainer');
    container.innerHTML = '';

    form.sections.forEach(section => {
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

    document.getElementById('formFieldsSection').style.display = 'block';
}

function renderFormField(field) {
    const container = document.createElement('div');
    container.className = 'form-field-container';

    if (field.type === 'text') {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        const label = document.createElement('label');
        label.htmlFor = `form_${field.name}`;
        label.textContent = field.label;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `form_${field.name}`;
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
        label.htmlFor = `form_${field.name}`;
        label.textContent = field.label;
        const textarea = document.createElement('textarea');
        textarea.id = `form_${field.name}`;
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
        input.id = `form_${field.name}`;
        input.className = 'form-field-input';
        input.dataset.field = field.name;
        input.checked = currentFormData[field.name] === true;
        const label = document.createElement('label');
        label.htmlFor = `form_${field.name}`;
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
        itemsContainer.id = `group_${field.name}`;

        const items = currentFormData[field.name] || [];
        items.forEach((item, index) => {
            const itemEl = renderRepeatingGroupItem(field, item, index);
            itemsContainer.appendChild(itemEl);
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
    itemDiv.id = `item_${field.name}_${index}`;

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

function resetFormFields() {
    document.getElementById('formFieldsSection').style.display = 'none';
    document.getElementById('formFieldsContainer').innerHTML = '';
    document.getElementById('formSelect').value = '';
    currentFormId = null;
    currentFormData = {};
}

function addRepeatingGroupRow(fieldName) {
    if (!currentFormData[fieldName]) {
        currentFormData[fieldName] = [];
    }

    const form = formsConfig.forms.find(f => f.id === currentFormId);
    const field = form.sections.flatMap(s => s.fields).find(f => f.name === fieldName);

    const newItem = {};
    field.subfields.forEach(subfield => {
        newItem[subfield.name] = '';
    });

    currentFormData[fieldName].push(newItem);

    const container = document.getElementById(`group_${fieldName}`);
    const index = currentFormData[fieldName].length - 1;
    const itemEl = renderRepeatingGroupItem(field, newItem, index);
    container.appendChild(itemEl);

    saveFormFields();
}

function removeRepeatingGroupRow(fieldName, index) {
    if (currentFormData[fieldName]) {
        currentFormData[fieldName].splice(index, 1);
        renderFormFields();
        saveFormFields();
    }
}

// ============================================
// FORM FIELDS MANAGEMENT
// ============================================

async function saveFormFields() {
    if (!currentClient || !currentFormId) return;

    // Collect all form-specific field values
    const formData = {};

    // Get regular fields
    document.querySelectorAll('#formFieldsContainer .form-field-input').forEach(input => {
        if (!input.dataset.index) { // Not a repeating group item
            const field = input.dataset.field;
            if (input.type === 'checkbox') {
                formData[field] = input.checked;
            } else {
                formData[field] = input.value;
            }
        }
    });

    // Get repeating group data
    document.querySelectorAll('#formFieldsContainer .repeating-group-item-field input').forEach(input => {
        const field = input.dataset.field;
        const subfield = input.dataset.subfield;
        const index = parseInt(input.dataset.index, 10);

        if (!formData[field]) {
            formData[field] = [];
        }

        if (!formData[field][index]) {
            formData[field][index] = {};
        }

        formData[field][index][subfield] = input.value;
    });

    currentFormData = formData;

    try {
        const { data: existingData, error: fetchError } = await db
            .from('form_submissions')
            .select('id')
            .eq('client_id', currentClient.id)
            .eq('form_id', currentFormId)
            .single();

        if (existingData) {
            // Update
            await db
                .from('form_submissions')
                .update({ form_data: formData })
                .eq('id', existingData.id);
        } else {
            // Insert
            await db
                .from('form_submissions')
                .insert([{
                    client_id: currentClient.id,
                    form_id: currentFormId,
                    form_data: formData,
                    created_by: currentUser.id
                }]);
        }
    } catch (error) {
        console.error('Error saving form fields:', error);
        showNotification('Failed to save form data', 'error');
    }
}

// ============================================
// DOCUMENT GENERATION
// ============================================

async function generateDocument() {
    if (!currentClient || !currentFormId) {
        showNotification('Please select a form first', 'error');
        return;
    }

    showLoading();

    try {
        const form = formsConfig.forms.find(f => f.id === currentFormId);
        if (!form) throw new Error('Form configuration not found');

        // Fetch the template
        const templateUrl = form.template;
        const response = await fetch(templateUrl);
        if (!response.ok) throw new Error('Failed to fetch template');
        const arrayBuffer = await response.arrayBuffer();

        // Prepare data for docxtemplater
        const templateData = prepareTemplateData();

        // Load and process template
        const zip = new window.PizZip(arrayBuffer);
        const doc = new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: function() { return ''; }
        });
        doc.setData(templateData);
        doc.render();

        // Generate document
        const blob = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        // Download
        const fileName = `${currentClient.aip_name || 'Form'}_${form.id}_${new Date().toISOString().split('T')[0]}.docx`;
        window.saveAs(blob, fileName);

        showNotification('Document generated successfully', 'success');
        showLoading(false);
    } catch (error) {
        console.error('Error generating document:', error);
        showNotification(`Failed to generate document: ${error.message}`, 'error');
        showLoading(false);
    }
}

function prepareTemplateData() {
    const data = {};

    // Add all core fields
    const coreFields = [
        'county', 'file_no', 'division',
        'petitioner_name', 'petitioner_age', 'petitioner_address', 'petitioner_relationship',
        'aip_name', 'aip_age', 'aip_county', 'aip_primary_language', 'aip_address',
        'attorney_name', 'attorney_email', 'attorney_bar_no', 'attorney_address', 'attorney_phone',
        'physician_name', 'physician_address', 'physician_phone'
    ];

    coreFields.forEach(field => {
        data[field] = currentClient[field] || '';
    });

    // Add form-specific fields
    Object.keys(currentFormData).forEach(key => {
        const value = currentFormData[key];

        if (typeof value === 'boolean') {
            // Convert checkbox to (X) or (  )
            data[key] = value ? '(X)' : '(  )';
            data[`${key}_check`] = value ? '(X)' : '(  )';
        } else if (Array.isArray(value)) {
            // Repeating group - pass as array
            data[key] = value;
        } else {
            // Regular text field
            data[key] = value || '';
        }
    });

    return data;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 4000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// START APP
// ============================================

document.addEventListener('DOMContentLoaded', initializeApp);
