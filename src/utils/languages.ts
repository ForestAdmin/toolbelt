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

export default { Javascript, Typescript };
