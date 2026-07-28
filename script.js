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

    // --- State Management ---
    let tasks = JSON.parse(localStorage.getItem('kanbanTasks')) || [];

    // --- Initialization ---
    initBoard();
    fetchDailyQuote();

    function initBoard() {
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
            const today = new Date();
            today.setHours(0,0,0,0);
            const due = new Date(task.dueDate);
            // adjust for local timezone offset so '2023-10-15' isn't parsed as previous day due to UTC
            due.setMinutes(due.getMinutes() + due.getTimezoneOffset());
            const isOverdue = due < today;
            const overdueClass = isOverdue && task.status !== 'done' ? 'text-overdue' : '';
            dateHTML += ` | <span class="${overdueClass}" title="Due Date"><i class="fa-regular fa-calendar"></i> ${task.dueDate}</span>`;
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

        tasks.forEach(task => {
            if (task.text.toLowerCase().includes(lowerFilter)) {
                const container = document.getElementById(`${task.status}-cards`);
                if (container) {
                    container.appendChild(createTaskElement(task));
                }
            }
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
                        tasks[taskIndex].status = newStatus;
                        saveTasks();
                        updateCounters();
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
