import os

def fix_login_page_correct():
    login_path = r"C:\Assignment\erp\transt\frontend\src\pages\LoginPage.jsx"
    with open(login_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # The actual button block:
    #                 'Sign In'
    #                 )}
    #               </Button>
    #             </Stack>
    #           </Box>
    #         </CardContent>

    if 'to="/register"' not in content:
        insert_text = """
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Don't have an account?{' '}
                  <Link component={RouterLink} to="/register" underline="hover" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    Sign up
                  </Link>
                </Typography>
              </Box>
"""
        content = content.replace("</Button>\n            </Stack>\n          </Box>", "</Button>\n" + insert_text + "            </Stack>\n          </Box>")
        
        with open(login_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated LoginPage.jsx successfully this time")
    else:
        print("Register link already exists")

fix_login_page_correct()
