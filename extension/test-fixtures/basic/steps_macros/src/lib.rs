extern crate proc_macro;
use proc_macro::TokenStream;

#[proc_macro_attribute]
pub fn given(_attr: TokenStream, item: TokenStream) -> TokenStream {
    // No-op: return the original item so code compiles.
    item
}

#[proc_macro_attribute]
pub fn when(_attr: TokenStream, item: TokenStream) -> TokenStream {
    item
}

#[proc_macro_attribute]
pub fn then(_attr: TokenStream, item: TokenStream) -> TokenStream {
    item
}
