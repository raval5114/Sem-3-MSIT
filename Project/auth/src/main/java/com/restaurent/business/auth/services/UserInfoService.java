package com.restaurent.business.auth.services;

import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.UserRequest;
import com.restaurent.business.auth.repos.RoleRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserInfoService implements UserDetailsService {

    @Autowired
    private UserDetailsRepository repository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Optional<UserInfo> userDetail = repository.findByemail(username);

        return userDetail.map(UserInfoDetails::new)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }

    public String addUser(UserRequest userRequest) {
        Role userRole = null;
        if (userRequest.getRoleName() != null) {
            userRole = roleRepository.findByName(userRequest.getRoleName())
                    .orElseThrow(() -> new RuntimeException("Role not found: " + userRequest.getRoleName()));
        }

        UserInfo userInfo = UserInfo.builder()
                .name(userRequest.getName())
                .email(userRequest.getEmail())
                .password(passwordEncoder.encode(userRequest.getPassword()))
                .role(userRole)
                .restaurantId(userRequest.getRestaurantId())
                .isActive(true)
                .build();

        repository.save(userInfo);
        return "User Added Successfully";
    }
}
