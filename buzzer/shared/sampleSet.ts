// The built-in sample set, so the app can be tried before anyone writes questions.
// Text only for now: the spec's two image questions arrive with images in F30.

import type { QuestionSet } from './types.js';

export const SAMPLE_SET: QuestionSet = {
  id: 'sample-general-knowledge',
  title: 'Sample: General Knowledge',
  questions: [
    {
      id: 'sample-q1',
      text: 'What is the largest planet in our solar system?',
      answer: 'Jupiter',
      points: 100,
    },
    {
      id: 'sample-q2',
      text: 'Which element has the chemical symbol "O"?',
      answer: 'Oxygen',
      points: 100,
    },
    {
      id: 'sample-q3',
      text: 'In which country would you find the ancient city of Petra?',
      answer: 'Jordan',
      points: 100,
    },
    {
      id: 'sample-q4',
      text: 'How many sides does a hexagon have?',
      answer: 'Six',
      points: 100,
    },
    {
      id: 'sample-q5',
      text: 'Who painted the Mona Lisa?',
      answer: 'Leonardo da Vinci',
      points: 100,
    },
    {
      id: 'sample-q6',
      text: 'What is the capital city of Canada?',
      answer: 'Ottawa',
      hostNotes: 'Not Toronto, the largest city.',
      points: 100,
    },
    {
      id: 'sample-q7',
      text: 'What is the hardest natural substance on Earth?',
      answer: 'Diamond',
      points: 100,
    },
    {
      id: 'sample-q8',
      text: 'How many minutes are there in a full day?',
      answer: '1440',
      hostNotes: '24 × 60.',
      points: 200,
    },
    {
      id: 'sample-q9',
      text: 'Which ocean lies between Africa and Australia?',
      answer: 'The Indian Ocean',
      points: 200,
    },
    {
      id: 'sample-q10',
      text: 'In what year did the first person walk on the Moon?',
      answer: '1969',
      hostNotes: 'Neil Armstrong, Apollo 11, 20 July 1969.',
      points: 300,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 1,
};
