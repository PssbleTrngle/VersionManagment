# Version Managment
Fetch latest version from tags and increment it based on pull request labels

## Inputs

### `token`
**Required** The github token.

### `fallback`
The version used if none is found. Default `"0.1.0"`.

### `last-version`
Custom version to use instead of searching in the tags.

### `prefix`
Prefix in front of version. Default `""`.
Example Prefix `"v"` -> Version `"v0.1.0"`

### `default-fragment`
Default increment fragment if none is found in `pull_request.labels` or `client_payload`. Default `"bug"`.

## Outputs

### `next`

The incremented version

## Example usage

```yml
- uses: actions/version-managment@v1
  id: version
  with:
      token: ${{secrets.GITHUB_TOKEN}}
      fallback: v0.1.0
      prefix: v
```