# Typeahead Debugging Guide

## How Typeahead Should Work

1. **User types** in the input field (e.g., "Bruno Mar")
2. **Frontend debounces** for 300ms after typing stops
3. **Frontend calls** `/api/typeahead?q=Bruno%20Mar&limit=8`
4. **Backend searches** for:
   - Events matching "Bruno Mar"
   - Venues matching "Bruno Mar"
   - Locations (cities/states) matching "Bruno Mar"
5. **Backend returns** suggestions array
6. **Frontend displays** dropdown with suggestions

## Current Status

✅ **Backend Service**: Exists at `/api/typeahead`  
✅ **Frontend Component**: Has typeahead logic in `ChatSearch.tsx`  
⚠️ **Issue**: Suggestions not appearing

## Debugging Steps

### 1. Check if Backend is Running

**For Local Development:**
```bash
cd ai-search-2.0
npm run offline
# Should start on http://localhost:4000
```

**Check if typeahead endpoint works:**
```bash
curl "http://localhost:4000/api/typeahead?q=Bruno%20Mar&limit=8"
```

**Expected response:**
```json
{
  "suggestions": [
    {
      "text": "Bruno Mars - Some Venue",
      "type": "event",
      "event_id": 123,
      "venue": "Some Venue",
      "city": "New York",
      "state": "NY"
    }
  ],
  "query": "Bruno Mar",
  "timestamp": "2026-01-20T..."
}
```

### 2. Check Frontend API URL

The frontend uses:
- **Development**: `http://localhost:4000` (or `NEXT_PUBLIC_CHAT_API_URL`)
- **Production**: `NEXT_PUBLIC_CHAT_API_URL` environment variable

**Check browser console:**
1. Open DevTools (F12)
2. Go to Network tab
3. Type in the input field
4. Look for requests to `/api/typeahead`

**What to look for:**
- ✅ Request appears after 300ms delay
- ✅ Request URL is correct
- ✅ Response status is 200
- ❌ Request fails (404, 500, CORS error)
- ❌ No request appears (frontend not calling API)

### 3. Check Browser Console Logs

The frontend **silently fails** on typeahead errors (by design), but logs warnings:

```javascript
// In chatSearchService.ts
console.warn('Typeahead request failed:', error);
```

**Check for:**
- CORS errors
- Network errors
- 404/500 errors
- API URL misconfiguration

### 4. Check Backend Logs

**If running locally:**
```bash
# Check serverless offline logs
# Should see requests like:
# GET /api/typeahead?q=Bruno%20Mar&limit=8
```

**If running in Lambda:**
```bash
aws logs tail /aws/lambda/ai-search-2-0-dev-api \
  --follow --profile sitix-INT --region us-east-1
```

**Look for:**
- Typeahead endpoint requests
- Database query errors
- Typeahead service errors

### 5. Test Typeahead Service Directly

**Test the backend service:**
```bash
# From ai-search-2.0 directory
npm run build
node -e "
const { getTypeaheadSuggestions } = require('./dist/services/typeaheadService');
getTypeaheadSuggestions('Bruno Mar', 8).then(result => {
  console.log(JSON.stringify(result, null, 2));
}).catch(err => {
  console.error('Error:', err);
});
"
```

## Common Issues

### Issue 1: Backend Not Running

**Symptoms:**
- No requests in Network tab
- Console shows connection errors

**Solution:**
```bash
cd ai-search-2.0
npm run offline
# Should start on http://localhost:4000
```

### Issue 2: Wrong API URL

**Symptoms:**
- Requests to wrong URL (404 errors)
- CORS errors

**Solution:**
Check environment variable:
```bash
# In frontend .env or .env.local
NEXT_PUBLIC_CHAT_API_URL=http://localhost:4000
```

### Issue 3: Database Connection Issues

**Symptoms:**
- Backend logs show database errors
- Typeahead returns empty suggestions

**Solution:**
- Check `POSTGRES_DATABASE_URL` in `.env`
- Test database connection:
  ```bash
  npm run test:connection
  ```

### Issue 4: Query Too Short

**Symptoms:**
- No suggestions for single character
- Works after 2+ characters

**This is expected behavior** - typeahead requires 2+ characters.

### Issue 5: Silent Failures

**Symptoms:**
- No errors in console
- No suggestions appear
- Network tab shows failed requests

**Solution:**
The frontend silently fails. Check:
1. Network tab for failed requests
2. Backend logs for errors
3. Browser console for warnings

## Quick Test Script

Create `test-typeahead.sh`:

```bash
#!/bin/bash
API_URL=${1:-http://localhost:4000}
QUERY=${2:-Bruno}

echo "Testing typeahead API: $API_URL"
echo "Query: $QUERY"
echo ""

curl -s "${API_URL}/api/typeahead?q=${QUERY}&limit=8" | jq .

echo ""
echo "✅ If you see suggestions above, backend is working"
echo "❌ If you see errors, check backend logs"
```

Run:
```bash
chmod +x test-typeahead.sh
./test-typeahead.sh http://localhost:4000 "Bruno Mar"
```

## Expected Behavior

1. **Type "Br"** → Wait 300ms → Suggestions appear
2. **Type "Bruno"** → Wait 300ms → More specific suggestions
3. **Type "Bruno Mar"** → Wait 300ms → Event suggestions appear
4. **Click suggestion** → Input fills with suggestion text
5. **Press Enter** → Sends message with suggestion

## Next Steps

1. **Check if backend is running** (Step 1)
2. **Check browser Network tab** (Step 2)
3. **Check browser console** (Step 3)
4. **Check backend logs** (Step 4)
5. **Test API directly** (Step 5)

---

*The typeahead feature silently fails on errors, so check Network tab and backend logs for issues.*
