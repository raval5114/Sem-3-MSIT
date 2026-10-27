package com.restaurent.business.auth.services;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.Privilege;

public class UserInfoDetails implements UserDetails {

    private final String email;
    private final String password;
    private final List<GrantedAuthority> authorities;
    private final UserInfo userInfo;

    public UserInfoDetails(UserInfo userInfo) {
        this.userInfo = userInfo;
        this.email = userInfo.getEmail();
        this.password = userInfo.getPassword();

        this.authorities = new ArrayList<>();
        if (userInfo.getRole() != null) {
            this.authorities.add(new SimpleGrantedAuthority(userInfo.getRole().getName()));
            if (userInfo.getRole().getPrivileges() != null) {
                for (Privilege privilege : userInfo.getRole().getPrivileges()) {
                    this.authorities.add(new SimpleGrantedAuthority(privilege.getName()));
                }
            }
        }
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    public UserInfo getUserInfo() {
        return userInfo;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return userInfo.isActive();
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return userInfo.isActive();
    }
}
