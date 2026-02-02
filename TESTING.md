# WhatsApp Azan Bot - Testing Guide

## Overview
Comprehensive testing setup with unit tests, integration tests, and test data configuration.

---

## Test Configuration

### Test Data
All test credentials are configured in `.env.test` and `tests/config/testData.ts`:

```typescript
TEST_GROUP_JID=120363425088099716@g.us
TEST_MESSAGE_NUMBER=917994107442  
TEST_SESSION_ID=916235234132
```

- **Test Group**: `120363425088099716@g.us` - Real WhatsApp group for testing
- **Test Number**: `917994107442` - Real number to send test messages
- **Session ID**: `916235234132` - Currently logged in bot session

---

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Integration Tests Only
```bash
npm run test:integration
```

---

## Test Files Created

### Unit Tests

#### `src/services/__tests__/azanService.test.ts`
Tests prayer time service functionality:
-  Find locations by name/district
- ✅ Get prayer times for specific dates
- ✅ Calculate next prayer
- ✅ Get all locations

### Integration Tests

#### `tests/integration/messageTracker.test.ts`
Tests message delivery tracking:
- ✅ Log group reminder messages
- ✅ Log personal command responses
- ✅ Update message status (delivered/failed)
- ✅ Calculate delivery statistics
- ✅ Query failed messages
- ✅ Count today's messages

---

## Manual Testing Workflow

### 1. Create Admin User
```bash
npm run create-admin
```
Enter username and password when prompted.

### 2. Start Server
```bash
npm run dev
```

### 3. Login
Navigate to `http://localhost:3000/login.html`
- Login with credentials created in step 1

### 4. Create Test Session
- Session ID: `916235234132`
- Display Name: `Test Bot`
- Click "Create Session"
- Scan QR code with WhatsApp

### 5. Discover Groups
- Select connected session from dropdown
- Click "Discover Groups"
- Verify test group `120363425088099716@g.us` appears

### 6. Add Group Mapping
- Select test group from dropdown
- Select location: "Kochi (Ernakulam)"
- Click "Add Mapping"

### 7. Send Test Message
The bot will automatically send prayer time reminders based on schedule.

To test personal commands, send from `917994107442`:
```
azan-kochi
azan-next-kochi
locations  
help
```

### 8. Verify Message Logs
Check database for message tracking:
```javascript
// MongoDB query
db.messagelogs.find({ sessionId: "916235234132" })
```

---

## Test Database

Tests use a separate database configured in `.env.test`:
```
MONGODB_URL=mongodb://localhost:27017/azanbot-test
```

**Note**: Integration tests will clean up test data automatically.

---

## Coverage Goals

Target test coverage:
- **Overall**: > 70%
- **Services**: > 80%
- **Critical Paths**: 100% (authentication, message tracking)

---

## Future Test Additions

### Planned Tests
- [ ] WebSocket event handler tests
- [ ] Authentication flow tests
- [ ] Session manager tests
- [ ] Reminder scheduler tests
- [ ] End-to-end tests with mock WhatsApp

---

## Debugging Tests

### Enable Debug Logging
```bash
LOG_LEVEL=debug npm test
```

### Run Single Test File
```bash
npm test -- azanService.test.ts
```

### Run Specific Test
```bash
npm test -- -t "should find location by exact name"
```

---

## CI/CD Integration

Add to GitHub Actions (`.github/workflows/test.yml`):
```yaml
- name: Run tests
  run: npm test
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

---

**Status**: Testing infrastructure complete ✅
