const STORAGE_KEY = 'todo-app-tasks';

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

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load tasks from localStorage', e);
    return [];
  }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks to localStorage', e);
  }
}

describe('LocalStorage Persistence', () => {
  let mockLocalStorage;
  
  beforeEach(() => {
    mockLocalStorage = {
      store: {},
      getItem: function(key) {
        return this.store[key] || null;
      },
      setItem: function(key, value) {
        this.store[key] = value;
      },
      clear: function() {
        this.store = {};
      }
    };
    
    global.localStorage = mockLocalStorage;
  });
  
  afterEach(() => {
    mockLocalStorage.clear();
  });
  
  describe('saveTasks', () => {
    it('should save valid tasks to localStorage', () => {
      const tasks = [
        { text: 'Task 1', createdAt: 1 },
        { text: 'Task 2', createdAt: 2 }
      ];
      
      saveTasks(tasks);
      
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored);
      assertDeepEqual(parsed, tasks, 'Saved tasks should match input');
    });
    
    it('should save empty array', () => {
      const tasks = [];
      
      saveTasks(tasks);
      
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored);
      assertDeepEqual(parsed, tasks, 'Should save empty array');
    });
    
    it('should handle save with single task', () => {
      const tasks = [{ text: 'Single task', createdAt: 123 }];
      
      saveTasks(tasks);
      
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored);
      assertEqual(parsed.length, 1, 'Should have 1 task');
      assertEqual(parsed[0].text, 'Single task', 'Text should match');
    });
  });
  
  describe('loadTasks', () => {
    it('should load tasks from localStorage when data exists', () => {
      const tasks = [
        { text: 'Task 1', createdAt: 1 },
        { text: 'Task 2', createdAt: 2 }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      
      const loaded = loadTasks();
      
      assertDeepEqual(loaded, tasks, 'Loaded tasks should match saved tasks');
    });
    
    it('should return empty array when localStorage is empty', () => {
      localStorage.clear();
      
      const loaded = loadTasks();
      
      assertDeepEqual(loaded, [], 'Should return empty array');
    });
    
    it('should return empty array when localStorage has null value', () => {
      localStorage.clear();
      
      const loaded = loadTasks();
      
      assertDeepEqual(loaded, [], 'Should return empty array for null');
    });
    
    it('should recover from corrupted data', () => {
      localStorage.setItem(STORAGE_KEY, '{invalid json}');
      
      const loaded = loadTasks();
      
      assertDeepEqual(loaded, [], 'Should return empty array on corrupted data');
    });
  });
  
  describe('Persistence Integration', () => {
    it('should persist tasks across save/load cycles', () => {
      const tasks = [
        { text: 'Task 1', createdAt: Date.now() },
        { text: 'Task 2', createdAt: Date.now() + 1 }
      ];
      
      saveTasks(tasks);
      const loaded = loadTasks();
      
      assertEqual(loaded.length, 2, 'Should have 2 tasks');
      assertEqual(loaded[0].text, 'Task 1', 'First task should match');
      assertEqual(loaded[1].text, 'Task 2', 'Second task should match');
    });
    
    it('should persist after adding new task', () => {
      const initialTasks = [{ text: 'Initial', createdAt: 1 }];
      saveTasks(initialTasks);
      
      const loaded = loadTasks();
      loaded.push({ text: 'New task', createdAt: 2 });
      saveTasks(loaded);
      
      const finalLoaded = loadTasks();
      assertEqual(finalLoaded.length, 2, 'Should have 2 tasks');
      assertEqual(finalLoaded[1].text, 'New task', 'New task should be persisted');
    });
    
    it('should persist after deleting task', () => {
      const initialTasks = [
        { text: 'Task 1', createdAt: 1 },
        { text: 'Task 2', createdAt: 2 },
        { text: 'Task 3', createdAt: 3 }
      ];
      saveTasks(initialTasks);
      
      const loaded = loadTasks();
      loaded.splice(1, 1);
      saveTasks(loaded);
      
      const finalLoaded = loadTasks();
      assertEqual(finalLoaded.length, 2, 'Should have 2 tasks');
      assertEqual(finalLoaded[0].text, 'Task 1', 'First task should remain');
      assertEqual(finalLoaded[1].text, 'Task 3', 'Third task should shift to second position');
    });
    
    it('should handle multiple save operations', () => {
      saveTasks([{ text: 'First', createdAt: 1 }]);
      saveTasks([{ text: 'Second', createdAt: 2 }]);
      
      const loaded = loadTasks();
      assertEqual(loaded.length, 1, 'Should have 1 task');
      assertEqual(loaded[0].text, 'Second', 'Should have the latest value');
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
