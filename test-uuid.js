const { v4: uuidv4 } = require('uuid');
console.log('Generated UUID:', uuidv4());
console.log(
  'UUID validation regex test:',
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuidv4()
  )
);
