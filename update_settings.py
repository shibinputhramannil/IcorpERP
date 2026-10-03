import re

def add_currency_settings():
    path = r"C:\Assignment\erp\transt\frontend\src\pages\SettingsPage.jsx"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to add currency_code to companyForm state
    
    # 1. Add to initial state
    content = re.sub(
        r'(const \[companyForm, setCompanyForm\] = useState\(\{[\s\S]*?phone:\s*\'\',)',
        r"\1\n    currency_code: 'INR',",
        content
    )

    # 2. Add to loadCompanySettings
    content = re.sub(
        r'(setCompanyForm\(\{[\s\S]*?phone:\s*data\.phone\s*\|\|\s*\'\',)',
        r"\1\n          currency_code: data.currency_code || 'INR',",
        content
    )

    # 3. Add UI inputs for currency and timezone
    ui_addition = """
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Localization & Currency (Phase 15.1)</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Base Currency"
                      name="currency_code"
                      value={companyForm.currency_code || 'INR'}
                      onChange={handleCompanyChange}
                      disabled={true}
                      helperText="Base currency cannot be changed after financial transactions have been recorded."
                    >
                      <MenuItem value="INR">INR — Indian Rupee (₹)</MenuItem>
                      <MenuItem value="USD" disabled>USD — US Dollar ($) (Coming Soon)</MenuItem>
                      <MenuItem value="EUR" disabled>EUR — Euro (€) (Coming Soon)</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Timezone"
                      name="timezone"
                      value="Asia/Kolkata"
                      disabled={true}
                      helperText="Default timezone for Indian localization."
                    >
                      <MenuItem value="Asia/Kolkata">Asia/Kolkata (IST)</MenuItem>
                    </TextField>
                  </Grid>
"""
    
    content = re.sub(
        r'(disabled=\{!companyForm\.can_edit\}\s*/>\s*</Grid>\s*)</Grid>',
        r'\1' + ui_addition + '\n                  </Grid>',
        content
    )
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        
add_currency_settings()
