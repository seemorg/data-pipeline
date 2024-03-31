import fs from 'fs/promises';
import { join as joinPath, parse as parsePath } from 'path';
import path from 'path';

interface AssetOptions {
  slug: string;
  facts?: string[];
}

export class Asset {
  static type: string;
  static language: string;
  static extension: string;
  static dir: string;
  static facts: string[] = [];
  public slug: string;

  constructor(options: AssetOptions | string) {
    if (typeof options === 'string') {
      this.slug = options;
    } else {
      this.slug = options.slug;
      Asset.facts = options.facts || [];
    }
  }

  get path(): string {
    return joinPath(
      `${(this.constructor as typeof Asset).dir}`,
      `${this.slug}${(this.constructor as typeof Asset).extension}`,
    );
  }

  get listEntry(): string {
    return `- a ${(this.constructor as typeof Asset).type} ${
      (this.constructor as typeof Asset).language
    } file - ${this.path}`;
  }

  get listFacts(): string {
    let factsList = `Type: ${
      (this.constructor as typeof Asset).type
    }, Language: ${(this.constructor as typeof Asset).language}, Path: ${this.path}`;
    const facts = this.getFactsFromClassHierarchy();
    if (facts.length > 0) {
      factsList += `\n${facts.join('\n')}`;
    }
    return factsList;
  }

  async render(): Promise<string> {
    const content = await this.read();
    if (content === null) {
      throw new Error(`Could not read file at path: ${this.path}`);
    }
    return `# ${(this.constructor as typeof Asset).type} ${
      this.slug
    }\n\`\`\`${(this.constructor as typeof Asset).language} ${
      this.path
    }\n${content}\n\`\`\``;
  }

  context(): string {
    return '';
  }

  async read(): Promise<string | null> {
    try {
      return await fs.readFile(this.path, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  async write(content: string): Promise<void> {
    const dirPath = parsePath(this.path).dir;
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(this.path, content, 'utf-8');
  }

  static getSlug(filePath: string): string | null {
    filePath = path.resolve(filePath);
    const dir = path.resolve((this as typeof Asset).dir);
    if (!filePath.includes(dir)) {
      return null;
    }
    const relativePath = path.relative(dir, filePath);
    const nameExt = relativePath.split('.');
    const name = nameExt.shift(); // Get the first part before '.' as name
    const ext = nameExt.join('.'); // Get the remaining parts as extension

    // Validate the extension
    if ('.' + ext !== (this as typeof Asset).extension) {
      return null;
    }

    return name || null; // Return the name as the slug
  }

  static async parse(markdown: string): Promise<Asset[]> {
    const regex = new RegExp(
      `\`\`\`(${this.language}) (${this.dir}/[^\\n]*)\\n([\\s\\S]*?)\\n\`\`\``,
      'g',
    );

    let match = regex.exec(markdown);
    const assets: Asset[] = [];
    // @ts-ignore
    while (match !== null) {
      const [, , _path, content] = match;

      const slug = this.getSlug(_path!);
      if (slug !== null) {
        // @ts-ignore
        const asset = new this(slug);
        await asset.write(content!);
        assets.push(asset);
      }
      match = regex.exec(markdown);
    }

    return assets;
  }

  private getFactsFromClassHierarchy(): string[] {
    const facts = [];
    let currentClass: any = this.constructor;
    while (currentClass !== Asset) {
      facts.unshift(...currentClass.facts);
      currentClass = Object.getPrototypeOf(currentClass);
    }
    return facts;
  }
}
