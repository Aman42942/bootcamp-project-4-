// Kanban Task Board Logic
// Author: Aman Kumar

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const taskInput = document.getElementById('task-input');
    const dueDateInput = document.getElementById('due-date-input');
    const tagSelect = document.getElementById('tag-select');
    const prioritySelect = document.getElementById('priority-select');
    const addTaskBtn = document.getElementById('add-task-btn');
    const searchInput = document.getElementById('search-input');
    const boardContainer = document.querySelector('.kanban-board');
    const clearDoneBtn = document.getElementById('clear-done-btn');
    const quoteElement = document.getElementById('daily-quote');
    const toastContainer = document.getElementById('toast-container');
    const themeToggle = document.getElementById('theme-toggle');
    const exportBtn = document.getElementById('export-btn');
    const importFile = document.getElementById('import-file');
    const sortSelect = document.getElementById('sort-select');
    const alarmSound = document.getElementById('alarm-sound');

    // --- State Management ---
    let tasks = JSON.parse(localStorage.getItem('kanbanTasks')) || [];

    // --- Initialization ---
    initBoard();
    fetchDailyQuote();

    function initBoard() {
        initTheme();
        startReminderSystem();
        renderAllTasks();
        updateCounters();
        setupDragAndDrop();
    }

    // --- Daily Quote (Fetch API) ---
    async function fetchDailyQuote() {
        try {
            // Using a public quotes API (DummyJSON is stable and doesn't require keys)
            const response = await fetch('https://dummyjson.com/quotes/random');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            quoteElement.textContent = `"${data.quote}" - ${data.author}`;
        } catch (error) {
            // Fallback quote
            quoteElement.textContent = '"The secret of getting ahead is getting started." - Mark Twain';
        }
    }

    // --- Toast Notifications ---
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // --- Task Creation ---
    function addTask() {
        const text = taskInput.value.trim();
        if (!text) {
            showToast('Please enter a task description.');
            return;
        }

        const newTask = {
            id: 'task-' + Date.now(),
            text: text,
            priority: prioritySelect.value,
            tag: tagSelect.value,
            dueDate: dueDateInput.value,
            status: 'todo', // Default status
            createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })
        };

        tasks.push(newTask);
        saveTasks();
        
        // Render only the new task
        const columnCards = document.getElementById('todo-cards');
        const cardElement = createTaskElement(newTask);
        columnCards.appendChild(cardElement);
        
        updateCounters();
        showToast('Task added successfully!');
        
        // Reset input
        taskInput.value = '';
        dueDateInput.value = '';
    }

    addTaskBtn.addEventListener('click', addTask);
    
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // --- Task Rendering ---
    function createTaskElement(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.draggable = true;
        card.id = task.id;
        card.dataset.priority = task.priority;
        
        let dateHTML = `<i class="fa-regular fa-clock"></i> ${task.createdAt}`;
        if (task.dueDate) {
            const dueDateTime = new Date(task.dueDate);
            const isOverdue = dueDateTime < new Date() && task.status !== 'done';
            
            // Format to a readable string like "Aug 20, 04:30 PM"
            const options = { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' };
            const formattedDue = dueDateTime.toLocaleDateString('en-US', options);

            dateHTML = `<span class="${isOverdue ? 'overdue-alert' : ''}"><i class="fa-solid fa-calendar-day"></i> Due: ${formattedDue}</span>`;
        }
        
        let tagHTML = task.tag ? `<span class="tag-badge">${task.tag}</span>` : '';

        card.innerHTML = `
            <div class="task-header">
                <div>
                    ${tagHTML}
                    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                </div>
                <button class="delete-btn" aria-label="Delete task"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div class="task-content" title="Double click to edit">${escapeHTML(task.text)}</div>
            <div class="task-footer">
                ${dateHTML}
            </div>
        `;

        // Drag events for this card
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        return card;
    }

    function renderAllTasks(filterText = '') {
        // Clear current columns (except empty states)
        const columns = ['todo', 'in-progress', 'done'];
        columns.forEach(col => {
            const container = document.getElementById(`${col}-cards`);
            // Keep the empty state div, remove everything else
            Array.from(container.children).forEach(child => {
                if (!child.classList.contains('empty-state')) {
                    child.remove();
                }
            });
        });

        const lowerFilter = filterText.toLowerCase();
        
        // Sorting Logic
        let sortedTasks = [...tasks];
        const sortMode = sortSelect ? sortSelect.value : 'default';
        
        if (sortMode === 'priority') {
            const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
            sortedTasks.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
        } else if (sortMode === 'dueDate') {
            sortedTasks.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            });
        }

        sortedTasks.forEach(task => {
            if (task.text.toLowerCase().includes(lowerFilter)) {
                const container = document.getElementById(`${task.status}-cards`);
                if (container) {
                    container.appendChild(createTaskElement(task));
                }
            }
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            renderAllTasks(searchInput.value);
        });
    }

    // --- Search / Filter ---
    searchInput.addEventListener('input', (e) => {
        renderAllTasks(e.target.value);
    });

    // --- Event Delegation (Delete & Edit) ---
    boardContainer.addEventListener('click', (e) => {
        // Delete Task
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const card = deleteBtn.closest('.task-card');
            const taskId = card.id;
            
            card.style.transform = 'scale(0)';
            card.style.opacity = '0';
            
            setTimeout(() => {
                tasks = tasks.filter(t => t.id !== taskId);
                saveTasks();
                card.remove();
                updateCounters();
                showToast('Task deleted');
            }, 200);
        }
    });

    // Inline Editing
    boardContainer.addEventListener('dblclick', (e) => {
        const contentDiv = e.target.closest('.task-content');
        if (contentDiv) {
            const card = contentDiv.closest('.task-card');
            const taskId = card.id;
            const currentText = contentDiv.textContent;
            
            contentDiv.contentEditable = true;
            contentDiv.classList.add('editing');
            contentDiv.focus();

            const saveEdit = () => {
                contentDiv.contentEditable = false;
                contentDiv.classList.remove('editing');
                const newText = contentDiv.textContent.trim();
                
                if (newText && newText !== currentText) {
                    const taskIndex = tasks.findIndex(t => t.id === taskId);
                    if (taskIndex > -1) {
                        tasks[taskIndex].text = newText;
                        saveTasks();
                        showToast('Task updated');
                    }
                } else {
                    // Revert if empty
                    contentDiv.textContent = currentText;
                }
                
                contentDiv.removeEventListener('blur', saveEdit);
                contentDiv.removeEventListener('keydown', handleKey);
            };

            const handleKey = (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    contentDiv.blur(); // Triggers blur event
                }
            };

            contentDiv.addEventListener('blur', saveEdit);
            contentDiv.addEventListener('keydown', handleKey);
        }
    });

    // --- Native HTML5 Drag & Drop ---
    let draggedCard = null;

    function handleDragStart(e) {
        draggedCard = this;
        this.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Required for Firefox
        e.dataTransfer.setData('text/plain', this.id);
    }

    function handleDragEnd(e) {
        this.classList.remove('is-dragging');
        draggedCard = null;
        
        // Remove drag-over styling from all columns
        document.querySelectorAll('.kanban-column').forEach(col => {
            col.classList.remove('drag-over');
        });
    }

    function setupDragAndDrop() {
        const columns = document.querySelectorAll('.kanban-column');
        
        columns.forEach(column => {
            column.addEventListener('dragover', e => {
                e.preventDefault(); // Necessary to allow dropping
                e.dataTransfer.dropEffect = 'move';
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', e => {
                e.preventDefault();
                column.classList.remove('drag-over');
                
                if (draggedCard) {
                    const newStatus = column.dataset.status;
                    const container = column.querySelector('.kanban-cards-container');
                    
                    // Append card to new column visually
                    container.appendChild(draggedCard);
                    
                    // Update state
                    const taskId = draggedCard.id;
                    const taskIndex = tasks.findIndex(t => t.id === taskId);
                    if (taskIndex > -1) {
                        const oldStatus = tasks[taskIndex].status;
                        tasks[taskIndex].status = newStatus;
                        saveTasks();
                        updateCounters();
                        
                        // 🎉 Confetti if moved to done
                        if (newStatus === 'done' && oldStatus !== 'done') {
                            if (typeof confetti === 'function') {
                                confetti({
                                    particleCount: 100,
                                    spread: 70,
                                    origin: { y: 0.6 }
                                });
                            }
                        }
                    }
                }
            });
        });
    }

    // --- Utilities ---
    function updateCounters() {
        const counts = { 'todo': 0, 'in-progress': 0, 'done': 0 };
        tasks.forEach(t => {
            if (counts[t.status] !== undefined) counts[t.status]++;
        });
        
        document.getElementById('todo-count').textContent = counts['todo'];
        document.getElementById('in-progress-count').textContent = counts['in-progress'];
        document.getElementById('done-count').textContent = counts['done'];
    }

    function saveTasks() {
        localStorage.setItem('kanbanTasks', JSON.stringify(tasks));
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Advanced Features ---
    
    // 1. Theme Toggle
    function initTheme() {
        if (!themeToggle) return;
        const savedTheme = localStorage.getItem('kanbanTheme') || 'light';
        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
            generateStars();
        }

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('kanbanTheme', 'light');
                themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
                clearStars();
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('kanbanTheme', 'dark');
                themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
                generateStars();
            }
        });
    }

    function generateStars() {
        const container = document.getElementById('twinkle-container');
        if (!container) return;
        container.innerHTML = ''; // clear existing
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            
            // Random properties
            const size = Math.random() * 3 + 1; // 1px to 4px
            const left = Math.random() * 100;
            const top = Math.random() * 100;
            const delay = Math.random() * 5;
            const duration = Math.random() * 3 + 2;
            
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.left = `${left}%`;
            star.style.top = `${top}%`;
            star.style.animationDelay = `${delay}s`;
            star.style.animationDuration = `${duration}s`;
            
            container.appendChild(star);
        }
    }

    function clearStars() {
        const container = document.getElementById('twinkle-container');
        if (container) container.innerHTML = '';
    }

    // 2. Export / Import Data
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(tasks, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'taskflow_backup.json';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Backup Exported!');
        });
    }

    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedTasks = JSON.parse(event.target.result);
                    if (Array.isArray(importedTasks)) {
                        tasks = importedTasks;
                        saveTasks();
                        renderAllTasks(searchInput.value);
                        updateCounters();
                        showToast('Backup Imported Successfully!');
                    }
                } catch (err) {
                    showToast('Error: Invalid Backup File');
                }
            };
            reader.readAsText(file);
        });
    }

    // 3. Reminder System
    function startReminderSystem() {
        if (!alarmSound) return;
        // Check every minute
        setInterval(() => {
            const now = new Date();
            let triggered = false;
            
            tasks.forEach(task => {
                if (task.dueDate && task.status !== 'done' && !task.notified) {
                    const dueDateTime = new Date(task.dueDate);
                    // If due date is reached or passed within the last 2 minutes
                    const diffMs = now - dueDateTime;
                    if (diffMs >= 0 && diffMs < 120000) {
                        task.notified = true; // prevent re-triggering
                        triggered = true;
                        showToast(`⏰ REMINDER: "${task.text}" is due!`);
                    }
                }
            });
            
            if (triggered) {
                saveTasks();
                alarmSound.play().catch(e => console.log('Audio play prevented by browser'));
            }
        }, 60000); // 1 minute
    }

    if (clearDoneBtn) {
        clearDoneBtn.addEventListener('click', () => {
            const doneTasks = tasks.filter(t => t.status === 'done');
            if (doneTasks.length === 0) return;
            
            if(confirm('Are you sure you want to clear all completed tasks?')) {
                tasks = tasks.filter(t => t.status !== 'done');
                saveTasks();
                renderAllTasks();
                updateCounters();
                showToast('Cleared all done tasks');
            }
        });
    }
});
