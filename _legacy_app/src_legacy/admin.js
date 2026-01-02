// Update Templates Stats
function updateTemplatesStats() {
    const totalTemplatesEl = document.getElementById('totalTemplates');
    if (totalTemplatesEl) {
        totalTemplatesEl.textContent = commonTemplates.length;
    }
}

// View Template
window.viewTemplate = (templateId) => {
    const template = commonTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    showModal(`
        <h2 style="margin-bottom: 1rem;">${template.name}</h2>
        <div style="margin-bottom: 1rem;">
            <span style="background: #dbeafe; color: #1e40af; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">${template.category}</span>
            <span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem;">₹${template.totalPrice}</span>
        </div>
        <div style="overflow-x: auto; max-height: 60vh;">
            <table>
                <thead>
                    <tr>
                        <th>Subtest Name</th>
                        <th>Unit</th>
                        <th>Male Range</th>
                        <th>Female Range</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${template.subtests.map((subtest, index) => `
                        <tr>
                            <td style="font-weight: 600;">${index + 1}. ${subtest.name}</td>
                            <td>${subtest.unit || 'N/A'}</td>
                            <td>${subtest.ranges.male.min} - ${subtest.ranges.male.max}</td>
                            <td>${subtest.ranges.female.min} - ${subtest.ranges.female.max}</td>
                            <td style="color: #16a34a; font-weight: 600;">₹${subtest.price}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <button onclick="closeModal()" class="btn btn-secondary w-full" style="margin-top: 1rem;">Close</button>
    `);
};

// Add Template Modal
window.openAddTemplateModal = () => {
    showModal(`
        <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-plus-circle" style="color: #16a34a;"></i> Add Common Template</h2>
        <form onsubmit="addTemplate(event)" style="max-height: 70vh; overflow-y: auto;">
            <input type="text" id="templateName" placeholder="Template Name (e.g., Complete Blood Count)" required>
            
            <select id="templateCategory" required>
                <option value="">Select Category</option>
                <option value="Hematology">Hematology</option>
                <option value="Biochemistry">Biochemistry</option>
                <option value="Microbiology">Microbiology</option>
                <option value="Immunology">Immunology</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Pathology">Pathology</option>
                <option value="Serology">Serology</option>
                <option value="Molecular Diagnostics">Molecular Diagnostics</option>
            </select>
            
            <input type="number" id="templatePrice" placeholder="Total Price (₹)" required min="0" step="0.01">
            
            <h3 style="margin: 1.5rem 0 1rem 0;">Subtests</h3>
            <div id="subtestsContainer"></div>
            
            <button type="button" onclick="addSubtestField()" class="btn" style="background: #4f46e5; color: white; width: 100%; margin-bottom: 1rem;">
                <i class="fas fa-plus"></i> Add Subtest
            </button>
            
            <div style="display: flex; gap: 0.5rem;">
                <button type="submit" class="btn btn-success" style="flex: 1;">
                    <i class="fas fa-save"></i> Save Template
                </button>
                <button type="button" onclick="closeModal()" class="btn btn-secondary">
                    Cancel
                </button>
            </div>
        </form>
    `);
    
    // Add initial subtest field
    addSubtestField();
};

// Add Subtest Field
window.addSubtestField = () => {
    const container = document.getElementById('subtestsContainer');
    const div = document.createElement('div');
    div.style.cssText = 'border: 2px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; background: #f9fafb;';
    div.innerHTML = `
        <input type="text" class="subtest-name" placeholder="Subtest Name (e.g., Hemoglobin)" required style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; margin-bottom: 0.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" class="subtest-unit" placeholder="Unit (e.g., g/dL)" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
            <select class="subtest-type" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                <option value="numeric">Numeric</option>
                <option value="text">Text</option>
            </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
            <div>
                <label style="font-size: 0.75rem; color: #6b7280; display: block; margin-bottom: 0.25rem;">Male Range</label>
                <div style="display: flex; gap: 0.25rem;">
                    <input type="number" step="0.01" class="subtest-male-min" placeholder="Min" required style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                    <input type="number" step="0.01" class="subtest-male-max" placeholder="Max" required style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                </div>
            </div>
            <div>
                <label style="font-size: 0.75rem; color: #6b7280; display: block; margin-bottom: 0.25rem;">Female Range</label>
                <div style="display: flex; gap: 0.25rem;">
                    <input type="number" step="0.01" class="subtest-female-min" placeholder="Min" required style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                    <input type="number" step="0.01" class="subtest-female-max" placeholder="Max" required style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                </div>
            </div>
        </div>
        <input type="number" step="0.01" class="subtest-price" placeholder="Subtest Price (₹)" required min="0" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; margin-bottom: 0.5rem;">
        <button type="button" onclick="this.parentElement.remove()" style="width: 100%; background: #fef2f2; color: #dc2626; padding: 0.5rem; border: 1px solid #fecaca; border-radius: 0.375rem; cursor: pointer;">
            <i class="fas fa-times"></i> Remove Subtest
        </button>
    `;
    container.appendChild(div);
};

// Add Template
window.addTemplate = async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('templateName').value.trim();
    const category = document.getElementById('templateCategory').value;
    const totalPrice = parseFloat(document.getElementById('templatePrice').value);
    
    const subtestDivs = document.querySelectorAll('#subtestsContainer > div');
    if (subtestDivs.length === 0) {
        alert('Please add at least one subtest');
        return;
    }
    
    const subtests = Array.from(subtestDivs).map(div => ({
        name: div.querySelector('.subtest-name').value.trim(),
        unit: div.querySelector('.subtest-unit').value.trim(),
        type: div.querySelector('.subtest-type').value,
        ranges: {
            male: {
                min: parseFloat(div.querySelector('.subtest-male-min').value),
                max: parseFloat(div.querySelector('.subtest-male-max').value)
            },
            female: {
                min: parseFloat(div.querySelector('.subtest-female-min').value),
                max: parseFloat(div.querySelector('.subtest-female-max').value)
            }
        },
        price: parseFloat(div.querySelector('.subtest-price').value)
    }));
    
    try {
        await push(ref(database, 'common_templates'), {
            name,
            category,
            totalPrice,
            subtests,
            createdAt: new Date().toISOString(),
            createdBy: 'admin'
        });
        
        showNotification('Template added successfully!', 'success');
        closeModal();
        await loadCommonTemplates();
    } catch (error) {
        alert('Error adding template: ' + error.message);
    }
};

// Edit Template
window.editTemplate = (templateId) => {
    const template = commonTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    const subtestsHTML = template.subtests.map(subtest => `
        <div style="border: 2px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; background: #f9fafb;">
            <input type="text" class="subtest-name" placeholder="Subtest Name" required value="${subtest.name}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; margin-bottom: 0.5rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                <input type="text" class="subtest-unit" placeholder="Unit" value="${subtest.unit}" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                <select class="subtest-type" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                    <option value="numeric" ${subtest.type === 'numeric' ? 'selected' : ''}>Numeric</option>
                    <option value="text" ${subtest.type === 'text' ? 'selected' : ''}>Text</option>
                </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                <div>
                    <label style="font-size: 0.75rem; color: #6b7280; display: block; margin-bottom: 0.25rem;">Male Range</label>
                    <div style="display: flex; gap: 0.25rem;">
                        <input type="number" step="0.01" class="subtest-male-min" placeholder="Min" required value="${subtest.ranges.male.min}" style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                        <input type="number" step="0.01" class="subtest-male-max" placeholder="Max" required value="${subtest.ranges.male.max}" style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                    </div>
                </div>
                <div>
                    <label style="font-size: 0.75rem; color: #6b7280; display: block; margin-bottom: 0.25rem;">Female Range</label>
                    <div style="display: flex; gap: 0.25rem;">
                        <input type="number" step="0.01" class="subtest-female-min" placeholder="Min" required value="${subtest.ranges.female.min}" style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                        <input type="number" step="0.01" class="subtest-female-max" placeholder="Max" required value="${subtest.ranges.female.max}" style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                    </div>
                </div>
            </div>
            <input type="number" step="0.01" class="subtest-price" placeholder="Price" required min="0" value="${subtest.price}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; margin-bottom: 0.5rem;">
            <button type="button" onclick="this.parentElement.remove()" style="width: 100%; background: #fef2f2; color: #dc2626; padding: 0.5rem; border: 1px solid #fecaca; border-radius: 0.375rem; cursor: pointer;">
                <i class="fas fa-times"></i> Remove
            </button>
        </div>
    `).join('');
    
    showModal(`
        <h2 style="margin-bottom: 1.5rem;"><i class="fas fa-edit" style="color: #16a34a;"></i> Edit Template</h2>
        <form onsubmit="updateTemplate(event, '${templateId}')" style="max-height: 70vh; overflow-y: auto;">
            <input type="text" id="editTemplateName" placeholder="Template Name" required value="${template.name}">
            
            <select id="editTemplateCategory" required>
                <option value="Hematology" ${template.category === 'Hematology' ? 'selected' : ''}>Hematology</option>
                <option value="Biochemistry" ${template.category === 'Biochemistry' ? 'selected' : ''}>Biochemistry</option>
                <option value="Microbiology" ${template.category === 'Microbiology' ? 'selected' : ''}>Microbiology</option>
                <option value="Immunology" ${template.category === 'Immunology' ? 'selected' : ''}>Immunology</option>
                <option value="Endocrinology" ${template.category === 'Endocrinology' ? 'selected' : ''}>Endocrinology</option>
                <option value="Pathology" ${template.category === 'Pathology' ? 'selected' : ''}>Pathology</option>
                <option value="Serology" ${template.category === 'Serology' ? 'selected' : ''}>Serology</option>
            </select>
            
            <input type="number" id="editTemplatePrice" placeholder="Total Price" required min="0" step="0.01" value="${template.totalPrice}">
            
            <h3 style="margin: 1.5rem 0 1rem 0;">Subtests</h3>
            <div id="editSubtestsContainer">${subtestsHTML}</div>
            
            <button type="button" onclick="addSubtestFieldEdit()" class="btn" style="background: #4f46e5; color: white; width: 100%; margin-bottom: 1rem;">
                <i class="fas fa-plus"></i> Add Subtest
            </button>
            
            <div style="display: flex; gap: 0.5rem;">
                <button type="submit" class="btn btn-success" style="flex: 1;">
                    <i class="fas fa-save"></i> Update Template
                </button>
                <button type="button" onclick="closeModal()" class="btn btn-secondary">
                    Cancel
                </button>
            </div>
        </form>
    `);
};

window.addSubtestFieldEdit = () => {
    const container = document.getElementById('editSubtestsContainer');
    const div = document.createElement('div');
    div.style.cssText = 'border: 2px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; background: #f9fafb;';
    div.innerHTML = `
        <input type="text" class="subtest-name" placeholder="Subtest Name" required style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; margin-bottom: 0.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" class="subtest-unit" placeholder="Unit" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
            <select class="subtest-type" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                <option value="numeric">Numeric</option>
                <option value="text">Text</option>
            </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
            <div>
                <label style="font-size: 0.75rem; color: #6b7280;">Male Range</label>
                <div style="display: flex; gap: 0.25rem;">
                    <input type="number" step="0.01" class="subtest-male-min" placeholder="Min" required style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                    <input type="number" step="0.01" class="subtest-male-max" placeholder="Max" required style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                </div>
            </div>
            <div>
                <label style="font-size: 0.75rem; color: #6b7280;">Female Range</label>
                <div style="display: flex; gap: 0.25rem;">
                    <input type="number" step="0.01" class="subtest-female-min" placeholder="Min" required style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                    <input type="number" step="0.01" class="subtest-female-max" placeholder="Max" required style="width: 100%; padding: 0.375rem; border: 1px solid #d1d5db; border-radius: 0.375rem;">
                </div>
            </div>
        </div>
        <input type="number" step="0.01" class="subtest-price" placeholder="Price" required min="0" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; margin-bottom: 0.5rem;">
        <button type="button" onclick="this.parentElement.remove()" style="width: 100%; background: #fef2f2; color: #dc2626; padding: 0.5rem; border-radius: 0.375rem; cursor: pointer;">
            <i class="fas fa-times"></i> Remove
        </button>
    `;
    container.appendChild(div);
};

// Update Template
window.updateTemplate = async (e, templateId) => {
    e.preventDefault();
    
    const name = document.getElementById('editTemplateName').value.trim();
    const category = document.getElementById('editTemplateCategory').value;
    const totalPrice = parseFloat(document.getElementById('editTemplatePrice').value);
    
    const subtestDivs = document.querySelectorAll('#editSubtestsContainer > div');
    const subtests = Array.from(subtestDivs).map(div => ({
        name: div.querySelector('.subtest-name').value.trim(),
        unit: div.querySelector('.subtest-unit').value.trim(),
        type: div.querySelector('.subtest-type').value,
        ranges: {
            male: {
                min: parseFloat(div.querySelector('.subtest-male-min').value),
                max: parseFloat(div.querySelector('.subtest-male-max').value)
            },
            female: {
                min: parseFloat(div.querySelector('.subtest-female-min').value),
                max: parseFloat(div.querySelector('.subtest-female-max').value)
            }
        },
        price: parseFloat(div.querySelector('.subtest-price').value)
    }));
    
    try {
        await update(ref(database, `common_templates/${templateId}`), {
            name,
            category,
            totalPrice,
            subtests,
            updatedAt: new Date().toISOString()
        });
        
        showNotification('Template updated successfully!', 'success');
        closeModal();
        await loadCommonTemplates();
    } catch (error) {
        alert('Error updating template: ' + error.message);
    }
};

// Delete Template
window.deleteTemplate = async (templateId) => {
    const template = commonTemplates.find(t => t.id === templateId);
    if (!confirm(`Delete template "${template.name}"?\n\nThis will remove it from all users' template lists.`)) return;
    
    try {
        await remove(ref(database, `common_templates/${templateId}`));
        showNotification('Template deleted successfully!', 'success');
        await loadCommonTemplates();
    } catch (error) {
        alert('Error deleting template: ' + error.message);
    }
};

// Tab Switching
window.switchAdminTab = (tabName) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });
    
    document.getElementById('labsTab').classList.add('hidden');
    document.getElementById('paymentsTab').classList.add('hidden');
    document.getElementById('templatesTab').classList.add('hidden');
    
    document.getElementById(`${tabName}Tab`).classList.remove('hidden');
    
    if (tabName === 'templates') {
        loadCommonTemplates();
    }
};

// Helper Functions
function showModal(content) {
    const modal = document.getElementById('modalContainer');
    modal.innerHTML = `
        <div class="modal-backdrop">
            <div class="modal-content">
                ${content}
            </div>
        </div>
    `;
}

function closeModal() {
    document.getElementById('modalContainer').innerHTML = '';
}

window.closeModal = closeModal;

function showNotification(message, type) {
    const bgColor = type === 'success' ? '#16a34a' : '#dc2626';
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        z-index: 2000;
        font-weight: 600;
    `;
    notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function renderPagination(containerId, totalPages, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }
    
    let html = '<div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem; flex-wrap: wrap;">';
    
    html += `<button class="btn" ${currentPage === 1 ? 'disabled' : ''} style="padding: 0.5rem 1rem;">Previous</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="btn ${i === currentPage ? 'btn-primary' : ''}" style="padding: 0.5rem 1rem;">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<span style="padding: 0.5rem;">...</span>';
        }
    }
    
    html += `<button class="btn" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 0.5rem 1rem;">Next</button>`;
    html += '</div>';
    
    container.innerHTML = html;
    
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn, index) => {
        if (index === 0 && currentPage > 1) {
            btn.onclick = () => onPageChange(currentPage - 1);
        } else if (index === buttons.length - 1 && currentPage < totalPages) {
            btn.onclick = () => onPageChange(currentPage + 1);
        } else if (index > 0 && index < buttons.length - 1) {
            const pageNum = parseInt(btn.textContent);
            if (!isNaN(pageNum)) {
                btn.onclick = () => onPageChange(pageNum);
            }
        }
    });
}
