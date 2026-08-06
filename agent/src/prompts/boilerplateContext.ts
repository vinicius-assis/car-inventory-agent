export const FIXED_BOILERPLATE_CONTEXT = `
The target project already provides these fixed pieces — do not redefine them, only import and use them:

- \`Car\` type (import from "@/types"):
  \`\`\`ts
  export interface Car {
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
    mobile: string;
    tablet: string;
    desktop: string;
  }
  \`\`\`
- GraphQL operations (import from "@/graphql/queries"): \`GET_CARS\`, \`GET_CAR\`, \`ADD_CAR\`.
  - \`GET_CARS\` takes no arguments and returns \`{ cars: Car[] }\`.
  - \`GET_CAR\` takes \`$id: ID!\` and returns \`{ car: Car | null }\`.
  - \`ADD_CAR\` takes \`$make: String!, $model: String!, $year: Int!, $color: String!\` and returns the newly created \`Car\` (the server assigns id and image URLs).
- Apollo Client is already configured at "@/graphql/client"; "@/main.tsx" already wraps the app in \`ApolloProvider\`, MUI's \`ThemeProvider\`, and MSW mocking. Generated code must not touch main.tsx.
- The path alias \`@/*\` maps to \`src/*\` (already configured in tsconfig and vite).
`.trim();
