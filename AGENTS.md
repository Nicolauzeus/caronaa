<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep CARONAA sample users and rides in `src/mockData.ts`, accessed through small mock services; this keeps the visual MVP replaceable by real data later.
- Keep the shared app header and navigation in a reusable shell, while every content page owns its TanStack route and metadata; this preserves direct links and responsive navigation.
