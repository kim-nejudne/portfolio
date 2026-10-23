export interface Plugin {
  name: string;
  render(text: string): string;
}
