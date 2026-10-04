import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

function mobileDeclaration(file: string, selector: string, property: string): string | undefined {
  const css = readFileSync(resolve(process.cwd(), file), 'utf8');
  const root = postcss.parse(css);
  let value: string | undefined;

  root.walkAtRules('media', (media) => {
    if (media.params !== '(max-width: 640px)') return;

    media.walkRules(selector, (rule) => {
      if (rule.selector !== selector) return;
      rule.walkDecls(property, (declaration) => {
        value = declaration.value;
      });
    });
  });

  return value;
}

describe('responsive heading typography', () => {
  it('keeps API-driven headings on heading-size tokens after refresh on mobile', () => {
    expect(
      mobileDeclaration(
        'src/app/elections/[electionId]/vote/vote.css',
        '.election-access-gate__title',
        'font-size'
      )
    ).toBe('var(--fs-heading-md)');
    expect(
      mobileDeclaration(
        'src/app/elections/[electionId]/vote/vote.css',
        '.election-head__title',
        'font-size'
      )
    ).toBe('var(--fs-title)');
    expect(
      mobileDeclaration(
        'src/app/elections/[electionId]/vote/vote.css',
        '.position__name',
        'font-size'
      )
    ).toBe('var(--fs-heading-sm)');
    expect(
      mobileDeclaration('src/app/components.css', '.event-card__title', 'font-size')
    ).toBe('var(--fs-heading-sm)');
  });
});
