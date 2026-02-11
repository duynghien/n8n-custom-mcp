# Usage Guide

This guide provides practical examples for using n8n-custom-mcp tools.

## Table of Contents

- [Workflow Management](#workflow-management)
- [Credentials Management](#credentials-management)
- [Workflow Validation](#workflow-validation)
- [Execution Monitoring](#execution-monitoring)
- [Webhook Testing](#webhook-testing)

---

## Workflow Management

### List Workflows

```json
{
  "tool": "list_workflows",
  "args": {
    "active": true,
    "limit": 10
  }
}
```

### Create Workflow

```json
{
  "tool": "create_workflow",
  "args": {
    "name": "My New Workflow",
    "nodes": [
      {
        "id": "webhook1",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 1,
        "position": [250, 300],
        "parameters": {
          "path": "my-webhook",
          "httpMethod": "POST"
        }
      },
      {
        "id": "set1",
        "name": "Set",
        "type": "n8n-nodes-base.set",
        "typeVersion": 1,
        "position": [450, 300],
        "parameters": {
          "values": {
            "string": [
              {
                "name": "message",
                "value": "Hello World"
              }
            ]
          }
        }
      }
    ],
    "connections": {
      "webhook1": {
        "main": [
          [
            {
              "node": "set1",
              "type": "main",
              "index": 0
            }
          ]
        ]
      }
    },
    "active": false
  }
}
```

### Update Workflow

```json
{
  "tool": "update_workflow",
  "args": {
    "id": "workflow-id-here",
    "name": "Updated Workflow Name",
    "active": true
  }
}
```

### Delete Workflow

```json
{
  "tool": "delete_workflow",
  "args": {
    "id": "workflow-id-here"
  }
}
```

---

## Credentials Management

### Get Credential Schema

Before creating credentials, get the schema to know required fields:

```json
{
  "tool": "get_credential_schema",
  "args": {
    "credentialType": "httpBasicAuth"
  }
}
```

**Response:**
```json
{
  "type": "httpBasicAuth",
  "displayName": "HTTP Basic Auth",
  "properties": [
    {
      "name": "user",
      "type": "string",
      "required": true,
      "description": "Username"
    },
    {
      "name": "password",
      "type": "string",
      "required": true,
      "description": "Password"
    }
  ]
}
```

### Create Credential

```json
{
  "tool": "create_credential",
  "args": {
    "name": "My API Credentials",
    "type": "httpBasicAuth",
    "data": {
      "user": "admin",
      "password": "secret123"
    }
  }
}
```

### List Credentials

```json
{
  "tool": "list_credentials",
  "args": {
    "includeData": false
  }
}
```

**Note:** Credentials are extracted from workflows. If PostgreSQL connection is available (via `DATABASE_URL` env var), it also queries the database for complete list.

### Update Credential

```json
{
  "tool": "update_credential",
  "args": {
    "id": "credential-id-here",
    "name": "Updated Credential Name",
    "data": {
      "user": "newuser",
      "password": "newpassword"
    }
  }
}
```

### Delete Credential

```json
{
  "tool": "delete_credential",
  "args": {
    "id": "credential-id-here"
  }
}
```

**Safety Check:** The tool will fail if the credential is currently used by any workflow.

---

## Workflow Validation

### Validate Workflow Structure

**Use Case:** Before creating or updating a workflow, validate its structure to catch errors early.

```json
{
  "tool": "validate_workflow_structure",
  "args": {
    "workflow": {
      "name": "Test Workflow",
      "nodes": [
        {
          "id": "webhook1",
          "name": "Webhook",
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 1,
          "position": [250, 300],
          "parameters": {}
        },
        {
          "id": "set1",
          "name": "Set",
          "type": "n8n-nodes-base.set",
          "typeVersion": 1,
          "position": [450, 300],
          "parameters": {}
        }
      ],
      "connections": {
        "webhook1": {
          "main": [
            [
              {
                "node": "set1",
                "type": "main",
                "index": 0
              }
            ]
          ]
        }
      },
      "active": false
    }
  }
}
```

**Response (Valid Workflow):**
```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

**Response (Invalid Workflow - Duplicate Node Names):**
```json
{
  "valid": false,
  "errors": [
    {
      "type": "duplicate_name",
      "message": "Node name 'HTTP Request' is duplicated",
      "nodeIds": ["node1", "node3"],
      "severity": "error"
    }
  ],
  "warnings": []
}
```

**Response (Missing Trigger for Active Workflow):**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "type": "missing_trigger",
      "message": "Workflow needs at least one trigger node to be activated",
      "severity": "warning"
    }
  ]
}
```

### Validation Checks Performed

1. **Required Fields** - `name` and `nodes` must be present
2. **Node ID Uniqueness** - No duplicate node IDs
3. **Node Name Uniqueness** - No duplicate node names (n8n requirement)
4. **Node Types** - All node types must exist on the n8n instance
5. **Valid Connections** - Connections must reference existing node IDs
6. **Trigger Nodes** - Active workflows should have at least one trigger (warning)
7. **Circular Dependencies** - No circular references in workflow graph
8. **Disabled Nodes** - Warning if disabled nodes have connections

### Common Validation Errors

**Empty Workflow:**
```json
{
  "valid": false,
  "errors": [
    {
      "type": "empty_workflow",
      "message": "Workflow must have at least one node",
      "severity": "error"
    }
  ]
}
```

**Invalid Node Type:**
```json
{
  "valid": false,
  "errors": [
    {
      "type": "invalid_node_type",
      "message": "Node type 'n8n-nodes-base.nonExistent' not found on this n8n instance",
      "nodeId": "node1",
      "severity": "error"
    }
  ]
}
```

**Circular Dependency:**
```json
{
  "valid": false,
  "errors": [
    {
      "type": "circular_dependency",
      "message": "Circular dependency detected in workflow connections",
      "severity": "error"
    }
  ]
}
```

**Invalid Connection:**
```json
{
  "valid": false,
  "errors": [
    {
      "type": "invalid_connection",
      "message": "Connection references non-existent target node: invalidNode",
      "severity": "error"
    }
  ]
}
```

---

## Execution Monitoring

### List Executions

```json
{
  "tool": "list_executions",
  "args": {
    "workflowId": "workflow-id-here",
    "status": "error",
    "limit": 10
  }
}
```

### Get Execution Details

```json
{
  "tool": "get_execution",
  "args": {
    "id": "execution-id-here"
  }
}
```

**Use Case:** Debug failed executions by examining error messages and node data.

---

## Webhook Testing

### Test Webhook (Test Mode)

```json
{
  "tool": "trigger_webhook",
  "args": {
    "path": "my-webhook",
    "method": "POST",
    "body": {
      "message": "Hello from MCP"
    },
    "headers": {
      "Content-Type": "application/json"
    },
    "testMode": true
  }
}
```

**Note:** Test mode uses `/webhook-test/` endpoint. Make sure workflow is open in n8n Editor.

### Production Webhook

```json
{
  "tool": "trigger_webhook",
  "args": {
    "path": "my-webhook",
    "method": "POST",
    "body": {
      "message": "Production data"
    },
    "testMode": false
  }
}
```

---

## Advanced Patterns

### AI Agent Workflow: Validate → Create → Execute

```json
// Step 1: Validate workflow structure
{
  "tool": "validate_workflow_structure",
  "args": { "workflow": { ... } }
}

// Step 2: If valid, create workflow
{
  "tool": "create_workflow",
  "args": { ... }
}

// Step 3: Execute workflow
{
  "tool": "execute_workflow",
  "args": { "id": "new-workflow-id" }
}

// Step 4: Monitor execution
{
  "tool": "get_execution",
  "args": { "id": "execution-id" }
}
```

### AI Agent Credentials: Schema → Create → Test

```json
// Step 1: Get credential schema
{
  "tool": "get_credential_schema",
  "args": { "credentialType": "httpBasicAuth" }
}

// Step 2: Create credential with validated data
{
  "tool": "create_credential",
  "args": {
    "name": "API Credentials",
    "type": "httpBasicAuth",
    "data": { "user": "admin", "password": "secret" }
  }
}

// Step 3: Test credential (if supported by credential type)
{
  "tool": "test_credential",
  "args": { "id": "credential-id" }
}
```

---

## Error Handling

All tools return errors in consistent format:

```json
{
  "error": "Error message here",
  "details": "Additional context if available"
}
```

**Common Errors:**
- `Missing required field: <field>` - Required parameter not provided
- `Workflow not found: <id>` - Workflow ID doesn't exist
- `Credential not found: <id>` - Credential ID doesn't exist
- `API Error: <message>` - n8n API returned error

**Best Practice:** Always validate workflows before creating them to catch errors early.
