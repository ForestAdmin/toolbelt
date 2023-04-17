export interface Language {
  name: string;
  fileExtension: string;
}

const Javascript: Language = {
  name: 'javascript',
  fileExtension: 'js',
};

const Typescript: Language = {
  name: 'typescript',
  fileExtension: 'ts',
};

const languages = { Javascript, Typescript };

export default languages;

export const languageList = Object.values({ Javascript, Typescript });
