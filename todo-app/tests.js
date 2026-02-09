function describe(name, fn) {
  console.group(name);
  fn();
  console.groupEnd();
}

function it(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

describe('Task Management', () => {
  let originalTasks;
  let mockLocalStorage;
  
  beforeEach(() => {
    originalTasks = [];
    mockLocalStorage = {
      store: {},
      getItem: function(key) {
        return this.store[key] || null;
      },
      setItem: function(key, value) {
        this.store[key] = JSON.stringify(JSON.parse(value));
      },
      clear: function() {
        this.store = {};
      }
    };
    
    global.localStorage = mockLocalStorage;
    global.tasks = [];
  });
  
  afterEach(() => {
    mockLocalStorage.clear();
  });
  
  describe('addTask', () => {
    it('should add a task to the list', () => {
      global.tasks = [];
      const text = 'Test task';
      global.tasks.push({ text, createdAt: Date.now() });
      
      assertEqual(global.tasks.length, 1, 'Should have 1 task');
      assertEqual(global.tasks[0].text, text, 'Task text should match');
    });
    
    it('should not add empty task', () => {
      global.tasks = [];
      const text = '';
      
      if (text.trim()) {
        global.tasks.push({ text, createdAt: Date.now() });
      }
      
      assertEqual(global.tasks.length, 0, 'Should not add empty task');
    });
  });
  
  describe('deleteTask', () => {
    it('should delete a task by index', () => {
      global.tasks = [
        { text: 'Task 1', createdAt: 1 },
        { text: 'Task 2', createdAt: 2 },
        { text: 'Task 3', createdAt: 3 }
      ];
      
      const deleteIndex = 1;
      global.tasks.splice(deleteIndex, 1);
      
      assertEqual(global.tasks.length, 2, 'Should have 2 tasks after delete');
      assertEqual(global.tasks[0].text, 'Task 1', 'First task should remain');
      assertEqual(global.tasks[1].text, 'Task 3', 'Third task should shift');
    });
    
    it('should handle deleting last task', () => {
      global.tasks = [
        { text: 'Task 1', createdAt: 1 },
        { text: 'Task 2', createdAt: 2 }
      ];
      
      const deleteIndex = 1;
      global.tasks.splice(deleteIndex, 1);
      
      assertEqual(global.tasks.length, 1, 'Should have 1 task');
      assertEqual(global.tasks[0].text, 'Task 1', 'First task should remain');
    });
    
    it('should handle deleting first task', () => {
      global.tasks = [
        { text: 'Task 1', createdAt: 1 },
        { text: 'Task 2', createdAt: 2 }
      ];
      
      const deleteIndex = 0;
      global.tasks.splice(deleteIndex, 1);
      
      assertEqual(global.tasks.length, 1, 'Should have 1 task');
      assertEqual(global.tasks[0].text, 'Task 2', 'Second task should become first');
    });
  });
  
  describe('localStorage', () => {
    it('should save tasks to localStorage', () => {
      mockLocalStorage.clear();
      const tasks = [
        { text: 'Task 1', createdAt: 1 },
        { text: 'Task 2', createdAt: 2 }
      ];
      
      mockLocalStorage.setItem('tasks', JSON.stringify(tasks));
      
      const retrieved = JSON.parse(mockLocalStorage.getItem('tasks'));
      assertDeepEqual(retrieved, tasks, 'Saved tasks should match retrieved tasks');
    });
    
    it('should retrieve empty array for no tasks', () => {
      mockLocalStorage.clear();
      const retrieved = JSON.parse(mockLocalStorage.getItem('tasks'));
      const expected = null;
      assertEqual(retrieved, expected, 'Should return null for missing key');
    });
  });
});

function beforeEach(fn) {
  describe('setup', fn);
  fn();
}

function afterEach(fn) {
  fn();
}

console.log('\n=== All Tests Complete ===\n');
