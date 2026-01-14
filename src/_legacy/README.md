# Legacy Code

This directory contains deprecated code that is being phased out as part of the domain-driven refactoring.

## Deprecated Modules

### questionnaireSteps/
Old questionnaire step components. These should be replaced with new domain-specific components in the appropriate modules.

### templates/
Old template management components. These should be replaced with new domain-specific components.

### RecipesManagement.tsx
Old recipe management component. This functionality should be moved to the appropriate domain module.

## Migration Notes

- Do not import from these files in new code
- Existing imports will be updated gradually
- These files will be removed once migration is complete

