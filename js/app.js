// CV Data State
const cvData = {
    personalInfo: {},
    skills: [],
    experience: [],
    education: []
};

// Toast notifications
function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        backgroundColor: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
    }).showToast();
}

// Add Skill
function addSkill() {
    const input = document.getElementById('skillInput');
    const skill = input.value.trim();
    
    if (skill && !cvData.skills.includes(skill)) {
        cvData.skills.push(skill);
        renderSkills();
        input.value = '';
    }
}

// Remove Skill
function removeSkill(skill) {
    cvData.skills = cvData.skills.filter(s => s !== skill);
    renderSkills();
}

// Render Skills
function renderSkills() {
    const container = document.getElementById('skillsList');
    container.innerHTML = cvData.skills.map(skill => `
        <span class="tag">
            ${skill}
            <button onclick="removeSkill('${skill}')" class="tag-remove">×</button>
        </span>
    `).join('');
}

// Generate Summary
async function generateSummary() {
    const profession = document.getElementById('profession').value.trim();
    const yearsExperience = document.getElementById('yearsExperience').value;
    const specialization = document.getElementById('specialization').value.trim();
    
    if (!profession) {
        showToast('Please enter your profession first', 'error');
        return;
    }
    
    const loadingSpan = document.getElementById('summaryLoading');
    const textSpan = document.getElementById('summaryText');
    loadingSpan.style.display = 'inline';
    textSpan.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai/suggest-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profession, yearsExperience, specialization })
        });
        
        const data = await response.json();
        
        if (data.summary) {
            document.getElementById('summary').value = data.summary;
            showToast('Summary generated successfully!', 'success');
        } else {
            showToast(data.error || 'Failed to generate summary', 'error');
        }
    } catch (error) {
        console.error('Summary Generation Error:', error);
        showToast('Failed to connect to the suggestion service', 'error');
    } finally {
        loadingSpan.style.display = 'none';
        textSpan.style.display = 'inline';
    }
}

// Suggest Skills
async function generateSkills() {
    const profession = document.getElementById('profession').value.trim();
    const yearsExperience = document.getElementById('yearsExperience').value;
    
    if (!profession) {
        showToast('Please enter your profession first', 'error');
        return;
    }
    
    const loadingSpan = document.getElementById('skillsLoading');
    const textSpan = document.getElementById('skillsText');
    loadingSpan.style.display = 'inline';
    textSpan.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai/suggest-skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profession, yearsExperience })
        });
        
        const data = await response.json();
        
        if (data.skills) {
            cvData.skills = [...new Set([...cvData.skills, ...data.skills])];
            renderSkills();
            showToast(`${data.skills.length} skills suggested!`, 'success');
        } else {
            showToast(data.error || 'Failed to generate skills', 'error');
        }
    } catch (error) {
        console.error('Skills Suggestion Error:', error);
        showToast('Failed to connect to the suggestion service', 'error');
    } finally {
        loadingSpan.style.display = 'none';
        textSpan.style.display = 'inline';
    }
}

// Add Experience Entry
function addExperience() {
    const id = Date.now();
    cvData.experience.push({ id, title: '', company: '', startDate: '', endDate: '', current: false, responsibilities: [] });
    renderExperience();
}

// Remove Experience
function removeExperience(id) {
    cvData.experience = cvData.experience.filter(exp => exp.id !== id);
    renderExperience();
}

// Render Experience
function renderExperience() {
    const container = document.getElementById('experienceList');
    container.innerHTML = cvData.experience.map((exp, index) => `
        <div class="experience-item">
            <h3>Experience ${index + 1}</h3>
            <div class="form-group">
                <label>Job Title</label>
                <input type="text" value="${exp.title}" onchange="updateExperience(${exp.id}, 'title', this.value)">
            </div>
            <div class="form-group">
                <label>Company</label>
                <input type="text" value="${exp.company}" onchange="updateExperience(${exp.id}, 'company', this.value)">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Start Date</label>
                    <input type="month" value="${exp.startDate}" onchange="updateExperience(${exp.id}, 'startDate', this.value)">
                </div>
                <div class="form-group">
                    <label>End Date</label>
                    <input type="month" value="${exp.endDate}" ${exp.current ? 'disabled' : ''} onchange="updateExperience(${exp.id}, 'endDate', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" ${exp.current ? 'checked' : ''} onchange="updateExperience(${exp.id}, 'current', this.checked)">
                    Currently working here
                </label>
            </div>
            <button type="button" class="btn-danger" onclick="removeExperience(${exp.id})">Remove</button>
        </div>
    `).join('');
}

// Update Experience
function updateExperience(id, field, value) {
    const exp = cvData.experience.find(e => e.id === id);
    if (exp) {
        exp[field] = value;
        if (field === 'current' && value) {
            exp.endDate = '';
        }
        renderExperience();
    }
}

// Add Education Entry
function addEducation() {
    const id = Date.now();
    cvData.education.push({ id, degree: '', institution: '', graduationDate: '' });
    renderEducation();
}

// Remove Education
function removeEducation(id) {
    cvData.education = cvData.education.filter(edu => edu.id !== id);
    renderEducation();
}

// Render Education
function renderEducation() {
    const container = document.getElementById('educationList');
    container.innerHTML = cvData.education.map((edu, index) => `
        <div class="education-item">
            <h3>Education ${index + 1}</h3>
            <div class="form-group">
                <label>Degree/Certification</label>
                <input type="text" value="${edu.degree}" onchange="updateEducation(${edu.id}, 'degree', this.value)">
            </div>
            <div class="form-group">
                <label>Institution</label>
                <input type="text" value="${edu.institution}" onchange="updateEducation(${edu.id}, 'institution', this.value)">
            </div>
            <div class="form-group">
                <label>Graduation Date</label>
                <input type="month" value="${edu.graduationDate}" onchange="updateEducation(${edu.id}, 'graduationDate', this.value)">
            </div>
            <button type="button" class="btn-danger" onclick="removeEducation(${edu.id})">Remove</button>
        </div>
    `).join('');
}

// Update Education
function updateEducation(id, field, value) {
    const edu = cvData.education.find(e => e.id === id);
    if (edu) {
        edu[field] = value;
    }
}

// Collect CV Data
function collectCVData() {
    return {
        personalInfo: {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            profession: document.getElementById('profession').value.trim(),
            yearsExperience: document.getElementById('yearsExperience').value,
            specialization: document.getElementById('specialization').value.trim(),
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            country: document.getElementById('country').value.trim(),
            summary: document.getElementById('summary').value.trim()
        },
        skills: cvData.skills,
        experience: cvData.experience,
        education: cvData.education
    };
}

// Handle Download with Lenco Payment
async function handleDownload() {
    const data = collectCVData();
    
    // Validation
    if (!data.personalInfo.fullName || !data.personalInfo.email) {
        showToast('Please fill in at least your name and email before downloading.', 'error');
        return;
    }
    
    const loadingSpan = document.getElementById('downloadLoading');
    const textSpan = document.getElementById('downloadText');
    loadingSpan.style.display = 'inline';
    textSpan.style.display = 'none';
    
    try {
        const reference = 'CV-' + Date.now();
        
        window.LencoPay.getPaid({
            key: LENCO_PUBLIC_KEY,
            reference: reference,
            email: data.personalInfo.email,
            amount: 50,
            currency: 'ZMW',
            channels: ['mobile-money'],
            customer: {
                name: data.personalInfo.fullName,
                phone: data.personalInfo.phone
            },
            onSuccess: async function(response) {
                showToast('Payment successful! Generating your CV...', 'success');
                
                try {
                    const generateResponse = await fetch(`${API_BASE_URL}/api/payment/generate-cv`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reference, cvData: data })
                    });
                    
                    const generateData = await generateResponse.json();
                    
                    if (generateData.success && generateData.pdfUrl) {
                        const link = document.createElement('a');
                        link.href = `${API_BASE_URL}${generateData.pdfUrl}`;
                        link.download = `CV_${data.personalInfo.fullName.replace(/\s+/g, '_')}.pdf`;
                        link.click();
                        showToast('CV downloaded successfully!', 'success');
                    } else {
                        showToast(generateData.error || 'Failed to generate CV', 'error');
                    }
                } catch (error) {
                    console.error('CV Generation Error:', error);
                    showToast('Failed to generate CV', 'error');
                } finally {
                    loadingSpan.style.display = 'none';
                    textSpan.style.display = 'inline';
                }
            },
            onClose: function() {
                showToast('Payment cancelled', 'info');
                loadingSpan.style.display = 'none';
                textSpan.style.display = 'inline';
            },
            onConfirmationPending: async function() {
                showToast('Payment confirmation pending...', 'info');
                
                // Poll for payment status
                let attempts = 0;
                const maxAttempts = 36; // 3 minutes
                
                const pollInterval = setInterval(async () => {
                    attempts++;
                    
                    try {
                        const verifyResponse = await fetch(`${API_BASE_URL}/api/payment/verify/${reference}`);
                        const verifyData = await verifyResponse.json();
                        
                        if (verifyData.success && verifyData.pdfUrl) {
                            clearInterval(pollInterval);
                            const link = document.createElement('a');
                            link.href = `${API_BASE_URL}${verifyData.pdfUrl}`;
                            link.download = `CV_${data.personalInfo.fullName.replace(/\s+/g, '_')}.pdf`;
                            link.click();
                            showToast('CV downloaded successfully!', 'success');
                            loadingSpan.style.display = 'none';
                            textSpan.style.display = 'inline';
                        } else if (verifyData.status === 'failed') {
                            clearInterval(pollInterval);
                            showToast('Payment failed. Please try again.', 'error');
                            loadingSpan.style.display = 'none';
                            textSpan.style.display = 'inline';
                        } else if (attempts >= maxAttempts) {
                            clearInterval(pollInterval);
                            showToast('Payment verification timeout. Please contact support.', 'error');
                            loadingSpan.style.display = 'none';
                            textSpan.style.display = 'inline';
                        }
                    } catch (error) {
                        console.error('Verification error:', error);
                    }
                }, 5000);
            }
        });
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Payment system not loaded. Please refresh the page and try again.', 'error');
        loadingSpan.style.display = 'none';
        textSpan.style.display = 'inline';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Add enter key support for skill input
    document.getElementById('skillInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSkill();
        }
    });
});
