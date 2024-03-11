import inquirer from 'inquirer';

const tasks = [
  {
    name: '[SEED] Authors',
    value: 'seed:authors',
    file: './tasks/seed/author.ts',
  },
  {
    name: '[SEED] Books',
    value: 'seed:books',
    file: './tasks/seed/book.ts',
  },
  {
    name: '[SEED] Genres',
    value: 'seed:genres',
    file: './tasks/seed/genre.ts',
  },
  {
    name: '[SEED] Locations',
    value: 'seed:locations',
    file: './tasks/seed/location.ts',
  },
  {
    name: '[SEED] Regions',
    value: 'seed:regions',
    file: './tasks/seed/region.ts',
  },
  new inquirer.Separator(),
  {
    name: '[TYPESENSE] Authors',
    value: 'typesense:authors',
    file: './tasks/typesense/index-authors.ts',
  },
  {
    name: '[TYPESENSE] Books',
    value: 'typesense:books',
    file: './tasks/typesense/index-titles.ts',
  },
  {
    name: '[TYPESENSE] Genres',
    value: 'typesense:genres',
    file: './tasks/typesense/index-genres.ts',
  },
  {
    name: '[TYPESENSE] Regions',
    value: 'typesense:regions',
    file: './tasks/typesense/index-regions.ts',
  },
];

type Task = Exclude<(typeof tasks)[number], inquirer.Separator>;

inquirer
  .prompt([
    {
      type: 'list',
      name: 'task',
      message: 'Select a task:',
      choices: tasks,
    },
  ])
  .then(async (answers: { task: string }) => {
    const task = tasks.find((t: any) => t.value === answers.task) as Task;
    try {
      await import(task.file);
    } catch (e) {
      console.error(e);
    }
  })
  .catch(error => {
    if (error.isTtyError) {
      // Prompt couldn't be rendered in the current environment
    } else {
      // Something else went wrong
    }
  });
