import { Asset } from './asset';

export class Artifact {
  private slug: string;
  private src: (typeof Asset)[];
  private dest: (typeof Asset)[];

  constructor(
    slug: string,
    src: typeof Asset | (typeof Asset)[],
    dest: typeof Asset | (typeof Asset)[],
  ) {
    this.slug = slug;
    this.src = Array.isArray(src) ? src : [src];
    this.dest = Array.isArray(dest) ? dest : [dest];
  }

  async canBuild(): Promise<boolean> {
    for (const AssetClass of this.src) {
      // @ts-ignore
      const asset = new AssetClass(this.slug);
      if ((await asset.read()) === null) {
        return false;
      }
    }
    return true;
  }

  async isBuilt(): Promise<boolean> {
    for (const AssetClass of [...this.src, ...this.dest]) {
      // @ts-ignore
      const asset = new AssetClass(this.slug);
      if ((await asset.read()) === null) {
        return false;
      }
    }
    return true;
  }

  async list(): Promise<string> {
    const srcList = [];
    const destList = [];

    for (const AssetClass of this.src) {
      // @ts-ignore
      const asset = new AssetClass(this.slug);
      srcList.push(asset.listEntry);
    }

    for (const AssetClass of this.dest) {
      // @ts-ignore
      const asset = new AssetClass(this.slug);
      destList.push(asset.listEntry);
    }

    return `## Src\n${srcList.join('\n')}\n## Dest\n${destList.join('\n')}`;
  }

  async facts(): Promise<string> {
    const facts = [];

    for (const AssetClass of [...this.src, ...this.dest]) {
      // @ts-ignore
      const asset = new AssetClass(this.slug);
      facts.push(asset.listFacts);
    }

    return `## Facts\n\n${facts.join('\n')}`;
  }

  async render(): Promise<string> {
    const renderings = [];

    for (const AssetClass of [...this.src, ...this.dest]) {
      // @ts-ignore
      const asset = new AssetClass(this.slug);
      renderings.push(await asset.render());
    }

    return renderings.join('\n');
  }
}
