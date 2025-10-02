![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-bluesky

This repository contains the code for the n8n nodes that interact with the [Bluesky API](https://docs.bsky.app/docs/category/http-reference).

## Installation

```bash
pnpm install @muench-dev/n8n-nodes-bluesky
```

In n8n community edition, you can install the nodes in the settings page.

## Features

- User
	- Block User
	- Get Profile
	- Mute User
	- Un-mute User
- Feed
	- Get Author Feed
	- Get Timeline of current user
- Post
	- Create Post
  - Like
  - Unlike
  - Repost
  - Delete Repost

## Screenshots

![images](.github/images/screenshot_20241128_174932.png)

## Use Cases

### RSS Feed to Bluesky

You can use the RSS Trigger node to get the latest posts from an RSS feed and then use the Create Post node to post them to Bluesky.

![images](.github/images/use_case_rss_trigger_overview.png)

Use Open Graph Tags to get the image and description of the post.

![images](.github/images/use_case_rss_trigger_node_details.png)

## Development

### Testing

This project includes comprehensive testing:

- **Unit Tests**: Run with `pnpm test` to test individual operations
- **Integration Tests**: The `n8n-integration-test.yml` workflow automatically tests the package installation in a vanilla n8n environment
- **Build Tests**: Verify TypeScript compilation and package structure

### n8n Integration Testing

The repository includes a GitHub Action workflow that tests the package in a real n8n environment to ensure:

- ✅ Package can be installed via npm/pnpm
- ✅ All required files are present in the built package
- ✅ Node and credential files can be loaded by n8n
- ✅ n8n starts successfully with the package installed
- ✅ API endpoints remain accessible

This integration test runs automatically on push and pull requests, testing against multiple n8n versions to ensure compatibility.
