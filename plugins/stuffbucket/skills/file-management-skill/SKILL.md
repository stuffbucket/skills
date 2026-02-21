---
name: file-management-skill
description: A skill for managing files and directories in a project. Use this skill when you need to navigate, read, modify, create, move, copy, or delete files and directories in a project workspace.
license: MIT
allowed-tools: read_file write_file list_directory create_directory delete_path move_path copy_path
---

# File Management Skill

This skill helps manage files and directories in a project workspace.

## When to Use This Skill

Use this skill when you need to:
- Navigate and explore project directories
- Read or modify file contents
- Create new files or directories
- Move, copy, or delete files and directories
- Organize project structure

## How to Use

1. Identify what file or directory operation you need to perform
2. Specify the exact path or paths involved
3. Choose the appropriate action (read, write, create, delete, move, copy)
4. Provide any necessary content or parameters for the operation

## Examples

- "List all files in the src directory"
- "Read the content of config.json"
- "Create a new directory called utils"
- "Move the api.js file from src to lib"
- "Delete the old-components folder"

## Guidelines

- Always specify full paths when referencing files or directories
- Be careful with destructive operations like delete - confirm before proceeding
- Use relative paths from the project root
- When creating files, consider the appropriate directory structure
- When moving files, ensure the destination directory exists or create it first

## Troubleshooting

If operations fail:
1. Verify that paths are correct and exist
2. Check that you have appropriate permissions
3. Confirm that file operations won't overwrite important data unintentionally
4. Ensure directory paths end with a slash when needed
