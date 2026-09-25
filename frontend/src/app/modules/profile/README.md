# Profile module

This module owns the authenticated user's profile screen, profile data access, and profile-specific presentation files.

## Ownership and dependencies

- `profile-page.ts` owns the profile form and user interactions.
- `profile.service.ts` owns requests to `/api/v1/users/me` and profile image endpoints.
- `profile.routes.ts` owns the feature route and lazy loading.
- The page may use the shared authentication session to refresh the current user after a profile or image update.
- The API remains responsible for authorization and field allowlists; the route guard only controls navigation.
- Keep profile-only types and behavior here. Promote code to `shared` or `core` only when another feature has a real use for it.

## Public route

The application route table mounts this feature at `/perfil`. Keep this URL stable when changing the module's internal structure.
